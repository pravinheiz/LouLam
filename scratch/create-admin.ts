import { db } from "../src/lib/db";
import * as bcrypt from "bcryptjs";
import { Role } from "../src/types/db";

async function main() {
  console.log("🚀 Creating default admin user...");

  const email = "pravinheisnam@gmail.com";
  const password = "Password123!";
  const hashedPassword = await bcrypt.hash(password, 10);

  // Check if user already exists
  const existingUser = await db.user.findFirst({ where: { email } });

  if (existingUser) {
    console.log(`👤 Updating existing user (${email}) to ADMIN...`);
    await db.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
        role: Role.ADMIN,
      },
    });
    console.log("✅ User successfully updated to Administrator!");
  } else {
    console.log(`👤 Creating Administrator account (${email})...`);
    await db.user.create({
      data: {
        name: "Administrator",
        email: email,
        password: hashedPassword,
        role: Role.ADMIN,
        image: null,
      },
    });
    console.log("✅ Administrator account successfully created!");
  }
}

main().catch((err) => {
  console.error("❌ Failed to create admin:", err);
  process.exit(1);
});
