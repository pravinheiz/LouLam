const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning database listings...');
  
  // 1. Delete all properties (this will cascade delete PropertyImage, PropertyPolygon, and Report)
  const deleteCount = await prisma.property.deleteMany({});
  console.log(`✅ Deleted ${deleteCount.count} property listings.`);

  // 2. Double check if any orphan images or polygons remain
  const imagesCount = await prisma.propertyImage.deleteMany({});
  const polygonsCount = await prisma.propertyPolygon.deleteMany({});
  console.log(`✅ Cleaned up ${imagesCount.count} orphan images and ${polygonsCount.count} polygons.`);
}

main()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
