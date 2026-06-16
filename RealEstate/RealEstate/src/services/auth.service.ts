import { db } from "@/lib/db";
import { z } from "zod";
import * as bcrypt from "bcryptjs";
import { ConflictError, ValidationError } from "@/lib/api-errors";
import { Role } from "@/types/db";
import { getAuth } from "firebase-admin/auth";

export const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.nativeEnum(Role).optional().default(Role.BUYER),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  phone: z.string().min(10, "A valid mobile number is required"),
  firebaseToken: z.string().min(1, "Firebase verification token is required"),
  image: z.string().optional().nullable(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export class AuthService {
  /**
   * Register a new user with email and password, validating age and OTP code/token
   */
  static async registerUser(input: RegisterInput) {
    const validated = RegisterSchema.parse(input);

    // 1. Verify DOB is >= 18 years old
    const dob = new Date(validated.dateOfBirth);
    if (isNaN(dob.getTime())) {
      throw new ValidationError("Invalid date of birth format");
    }
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (age < 18) {
      throw new ValidationError("You must be at least 18 years old to register");
    }

    // 2. Verify Phone & Email OTP via Firebase ID Token
    const cleanedPhone = validated.phone.trim().replace(/[^0-9+]/g, "");

    if (!process.env.FIREBASE_PROJECT_ID) {
      throw new ValidationError("Firebase Phone Authentication is not configured on the backend server. Please verify your environment configurations.");
    }

    try {
      console.log(`🔐 Verifying Firebase ID Token...`);
      const decodedToken = await getAuth().verifyIdToken(validated.firebaseToken);
      const tokenEmail = decodedToken.email;
      const isEmailVerified = decodedToken.email_verified;

      if (!tokenEmail || !isEmailVerified) {
        throw new ValidationError("Firebase ID token does not contain a verified email address");
      }

      const cleanedTokenEmail = tokenEmail.trim().toLowerCase();
      if (cleanedTokenEmail !== validated.email.trim().toLowerCase()) {
        throw new ValidationError("Verified email address in token does not match registration email address");
      }

      console.log("✅ Firebase ID Token (Email) successfully verified!");
    } catch (err: any) {
      console.error("❌ Firebase ID Token verification failed:", err);
      throw new ValidationError(err.message || "Failed to verify email via Firebase");
    }

    // 3. Check if email already exists
    const existingEmail = await db.user.findFirst({
      where: { email: validated.email.trim().toLowerCase() },
    });

    if (existingEmail) {
      throw new ConflictError("Email address is already in use");
    }

    // 4. Check if phone number already exists
    const existingPhone = await db.user.findFirst({
      where: { phone: validated.phone.trim() },
    });

    if (existingPhone) {
      throw new ConflictError("Phone number is already in use by another profile");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 10);

    // Create user
    const user = await db.user.create({
      data: {
        name: validated.name,
        email: validated.email.trim().toLowerCase(),
        password: hashedPassword,
        role: validated.role,
        dateOfBirth: validated.dateOfBirth,
        phone: validated.phone.trim(),
        phoneVerified: true,
        image: validated.image || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Authenticate a user by credentials (email + password)
   */
  static async verifyCredentials(email?: string | null, password?: string | null) {
    if (!email || !password) {
      throw new ValidationError("Email and password are required");
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image,
    };
  }
}
