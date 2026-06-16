import { db } from "@/lib/db";
import { ValidationError } from "@/lib/api-errors";

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  propertyId: string | null;
  content: string;
  status: string;
  createdAt: Date;
}

export interface ConversationThread {
  messageId: string;
  content: string;
  status: string;
  createdAt: Date;
  senderId: string;
  receiverId: string;
  propertyId: string | null;
  otherParticipant: {
    id: string;
    name: string | null;
    image: string | null;
    isVerified: boolean;
  };
  property: {
    id: string;
    title: string;
    price: number;
    imageUrl: string | null;
  } | null;
}

export class ChatService {
  /**
   * Send a message to another user, optionally linked to a property listing.
   */
  static async sendMessage(
    senderId: string,
    receiverId: string,
    propertyId: string | null,
    content: string
  ): Promise<ChatMessage> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new ValidationError("Message content cannot be empty");
    }
    if (senderId === receiverId) {
      throw new ValidationError("You cannot send a message to yourself");
    }

    // Verify receiver exists
    const receiverExists = await db.user.findUnique({
      where: { id: receiverId },
    });
    if (!receiverExists) {
      throw new ValidationError("Recipient user not found");
    }

    // Verify property exists if linked
    if (propertyId) {
      const propertyExists = await db.property.findUnique({
        where: { id: propertyId },
      });
      if (!propertyExists) {
        throw new ValidationError("Associated property listing not found");
      }
    }

    const message = await db.message.create({
      data: {
        senderId,
        receiverId,
        propertyId: propertyId || null,
        content: trimmed,
        status: "SENT",
      },
    });

    return {
      ...message,
      createdAt: new Date(message.createdAt),
    };
  }

  /**
   * Retrieves all conversation threads for a user, ordered by latest message.
   */
  static async getConversations(userId: string): Promise<ConversationThread[]> {
    // 1. Fetch all messages
    const allMessages = await db.message.findMany();

    // 2. Filter messages involving the current user
    const myMessages = allMessages.filter(
      (m: any) => m.senderId === userId || m.receiverId === userId
    );

    // 3. Auto-upgrade received messages to DELIVERED
    const receivedSentMessages = myMessages.filter(
      (m: any) => m.receiverId === userId && m.status === "SENT"
    );
    for (const msg of receivedSentMessages) {
      await db.message.update({
        where: { id: msg.id },
        data: { status: "DELIVERED" },
      });
      msg.status = "DELIVERED"; // update local cache
    }

    // 4. Group by (otherParticipantId, propertyId) to find the last message
    const threadsMap = new Map<string, any>();

    for (const msg of myMessages) {
      const otherParticipantId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      const propertyId = msg.propertyId || "null";
      const key = `${otherParticipantId}_${propertyId}`;

      const existing = threadsMap.get(key);
      if (!existing || new Date(msg.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        threadsMap.set(key, {
          ...msg,
          otherParticipantId,
        });
      }
    }

    // 5. Hydrate threads with user and property details
    const hydratedThreads: ConversationThread[] = await Promise.all(
      Array.from(threadsMap.values()).map(async (threadMsg) => {
        // Fetch participant details
        const participant = await db.user.findUnique({
          where: { id: threadMsg.otherParticipantId },
        });

        // Fetch participant verification status
        const verification = await db.sellerVerification.findUnique({
          where: { userId: threadMsg.otherParticipantId },
        });

        // Fetch property details if linked
        let property = null;
        if (threadMsg.propertyId) {
          const prop = await db.property.findUnique({
            where: { id: threadMsg.propertyId },
          });
          if (prop) {
            // Get first image
            const images = await db.propertyImage.findMany({
              where: { propertyId: prop.id },
              orderBy: { order: "asc" },
              take: 1,
            });
            property = {
              id: prop.id,
              title: prop.title,
              price: prop.price,
              imageUrl: images[0]?.url || null,
            };
          }
        }

        return {
          messageId: threadMsg.id,
          content: threadMsg.content,
          status: threadMsg.status,
          createdAt: new Date(threadMsg.createdAt),
          senderId: threadMsg.senderId,
          receiverId: threadMsg.receiverId,
          propertyId: threadMsg.propertyId,
          otherParticipant: {
            id: threadMsg.otherParticipantId,
            name: participant?.name || null,
            image: participant?.image || null,
            isVerified: verification?.status === "APPROVED",
          },
          property,
        };
      })
    );

    // 6. Sort threads by latest message createdAt DESC
    hydratedThreads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return hydratedThreads;
  }

  /**
   * Retrieves message history between two users, optionally filtered by property context.
   */
  static async getMessages(
    userId: string,
    otherId: string,
    propertyId: string | null,
    since?: string
  ): Promise<ChatMessage[]> {
    // 1. Fetch all messages
    const allMessages = await db.message.findMany();

    // 2. Filter messages between these two participants with this property id
    const chatHistory = allMessages.filter((m: any) => {
      const matchParticipants =
        (m.senderId === userId && m.receiverId === otherId) ||
        (m.senderId === otherId && m.receiverId === userId);
      const matchProperty = m.propertyId === (propertyId || null);
      return matchParticipants && matchProperty;
    });

    // 3. Mark received messages from this sender as READ
    const receivedUnread = chatHistory.filter(
      (m: any) => m.receiverId === userId && m.senderId === otherId && m.status !== "READ"
    );

    for (const msg of receivedUnread) {
      await db.message.update({
        where: { id: msg.id },
        data: { status: "READ" },
      });
      msg.status = "READ"; // update local cache
    }

    // 4. Filter by 'since' timestamp if provided
    let filteredHistory = chatHistory;
    if (since) {
      const sinceTime = new Date(since).getTime();
      if (!isNaN(sinceTime)) {
        filteredHistory = chatHistory.filter(
          (m: any) => new Date(m.createdAt).getTime() > sinceTime
        );
      }
    }

    // 5. Sort by createdAt ASC
    filteredHistory.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return filteredHistory.map((m: any) => ({
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      propertyId: m.propertyId,
      content: m.content,
      status: m.status,
      createdAt: new Date(m.createdAt),
    }));
  }
}
