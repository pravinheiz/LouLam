import { db } from "../src/lib/db";
import * as bcrypt from "bcryptjs";
import { Role } from "../src/types/db";

async function main() {
  console.log("🚀 Initializing database...");

  const collections = [
    { name: "users", client: db.user },
    { name: "properties", client: db.property },
    { name: "propertyImages", client: db.propertyImage },
    { name: "propertyPolygons", client: db.propertyPolygon },
    { name: "messages", client: db.message },
    { name: "sellerVerifications", client: db.sellerVerification },
    { name: "reports", client: db.report },
    { name: "auditLogs", client: db.auditLog },
  ];

  // 1. Clear all collections for a clean slate
  for (const col of collections) {
    console.log(`🧹 Clearing ${col.name} collection...`);
    try {
      const res = await col.client.deleteMany({});
      console.log(`   Cleaned ${res.count} items from ${col.name}`);
    } catch (err) {
      console.warn(`   Warning: Could not clear ${col.name}:`, err);
    }
  }

  // 2. Hash admin password
  const email = "md@athubiholding.com";
  const password = "Password123!";
  const hashedPassword = await bcrypt.hash(password, 10);

  // 3. Create Admin User
  console.log(`👤 Creating Administrator account (${email})...`);
  const adminUser = await db.user.create({
    data: {
      name: "Administrator",
      email: email,
      password: hashedPassword,
      role: Role.ADMIN,
      image: null,
    },
  });

  console.log("✅ Administrator account successfully created:");
  console.log(`   Email: ${adminUser.email}`);
  console.log(`   Role:  ${adminUser.role}`);
  console.log("✨ Database initialization complete!");
}

main().catch((err) => {
  console.error("❌ Database initialization failed:", err);
  process.exit(1);
});
