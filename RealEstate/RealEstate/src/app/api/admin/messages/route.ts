import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/types/db";

/**
 * GET /api/admin/messages
 * Retrieves conversation history between two users, or a list of all messages.
 * Restricted to users with ADMIN role.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const session = await auth();
  if (!session || session.user?.role !== Role.ADMIN) {
    return ApiResponse.error("Unauthorized. Admin privileges required.", 401);
  }

  const { searchParams } = new URL(request.url);
  const user1 = searchParams.get("user1");
  const user2 = searchParams.get("user2");

  const allMessages = await db.message.findMany();

  if (user1 && user2) {
    // Filter messages exchanged between user1 and user2
    const filtered = allMessages.filter(
      (m: any) =>
        (m.senderId === user1 && m.receiverId === user2) ||
        (m.senderId === user2 && m.receiverId === user1)
    );

    // Sort by creation time ascending (chronological chat flow)
    filtered.sort(
      (a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return ApiResponse.success(filtered, "Chat history retrieved successfully");
  }

  // Otherwise, return all messages, sorted descending by creation time (newest first)
  allMessages.sort(
    (a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return ApiResponse.success(allMessages, "All message logs retrieved");
});
