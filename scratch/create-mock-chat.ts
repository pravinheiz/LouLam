import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Finding test buyer and agent accounts...");
  
  const buyer = await prisma.user.findUnique({
    where: { email: "buyer@marketplace.com" },
  });
  
  const agent = await prisma.user.findUnique({
    where: { email: "agent@marketplace.com" },
  });

  if (!buyer || !agent) {
    console.error("❌ Seeded users not found. Please run db seeding first.");
    process.exit(1);
  }

  console.log(`... Found Buyer: ${buyer.name} (${buyer.id})`);
  console.log(`... Found Agent: ${agent.name} (${agent.id})`);

  console.log("🔍 Finding luxury villa property listing...");
  const property = await prisma.property.findFirst({
    where: { title: { contains: "Villa" } },
  });

  if (!property) {
    console.error("❌ Seeded property listing not found.");
    process.exit(1);
  }

  console.log(`... Found Property: ${property.title} (${property.id})`);

  // Clear existing messages
  await prisma.message.deleteMany({
    where: {
      propertyId: property.id,
      OR: [
        { senderId: buyer.id, receiverId: agent.id },
        { senderId: agent.id, receiverId: buyer.id },
      ],
    },
  });

  console.log("🌱 Inserting mock back-and-forth negotiation messages...");

  const baseTime = new Date();
  baseTime.setHours(baseTime.getHours() - 1); // Started 1 hour ago

  const mockDialogs = [
    {
      senderId: buyer.id,
      receiverId: agent.id,
      content: `Hello ${agent.name}! I saw your listing for the ${property.title}. Is it available for site viewing this coming Saturday?`,
      timeOffsetMins: 0,
      status: "READ",
    },
    {
      senderId: agent.id,
      receiverId: buyer.id,
      content: `Hi ${buyer.name}! Yes, the villa is active and available. Saturday afternoon around 2 PM works great. Would that suit your schedule?`,
      timeOffsetMins: 5,
      status: "READ",
    },
    {
      senderId: buyer.id,
      receiverId: agent.id,
      content: "That works perfectly for me. Please let me know if I need to share any legal documents or verify my profile status before the visit.",
      timeOffsetMins: 10,
      status: "READ",
    },
    {
      senderId: agent.id,
      receiverId: buyer.id,
      content: `Awesome. Just make sure your legal name matches your profile, and bring a valid government ID for security at the gate. I've sent the location details to your contact card. See you Saturday!`,
      timeOffsetMins: 12,
      status: "SENT",
    },
  ];

  for (const dialog of mockDialogs) {
    const messageTime = new Date(baseTime.getTime() + dialog.timeOffsetMins * 60000);
    
    await prisma.message.create({
      data: {
        senderId: dialog.senderId,
        receiverId: dialog.receiverId,
        propertyId: property.id,
        content: dialog.content,
        status: dialog.status,
        createdAt: messageTime,
        updatedAt: messageTime,
      },
    });
  }

  console.log("✅ Mock conversation successfully initiated!");
}

main()
  .catch((e) => {
    console.error("❌ Failed to initiate mock chat:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
