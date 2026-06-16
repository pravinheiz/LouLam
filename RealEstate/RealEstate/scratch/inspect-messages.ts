import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const messages = await prisma.message.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log('Last 10 messages in database:');
  console.dir(messages, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
