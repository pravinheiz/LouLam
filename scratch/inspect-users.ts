import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    }
  });
  console.log('Users in database:');
  console.dir(users, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
