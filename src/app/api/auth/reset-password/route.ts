import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { ValidationError, NotFoundError } from "@/lib/api-errors";
import * as bcrypt from "bcryptjs";

const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const { token, newPassword } = ResetPasswordSchema.parse(body);

  // Find token in the OTP collection
  const otpRecord = await db.otp.findUnique({
    where: { id: token },
  });

  if (!otpRecord || otpRecord.type !== "PASSWORD_RESET") {
    throw new ValidationError("Invalid or expired password reset link");
  }

  // Check expiration
  if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
    // Clean up expired token
    await db.otp.delete({ where: { id: token } });
    throw new ValidationError("This password reset link has expired");
  }

  const email = otpRecord.email;

  // Find user
  const user = await db.user.findFirst({
    where: { email },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password in Custom DB
  await db.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  // Also update password in Firebase Auth to keep credentials in sync
  try {
    if (process.env.FIREBASE_PROJECT_ID) {
      const { getAuth } = await import("firebase-admin/auth");
      const auth = getAuth();
      const firebaseUser = await auth.getUserByEmail(email).catch(() => null);
      if (firebaseUser) {
        await auth.updateUser(firebaseUser.uid, { password: newPassword });
        console.log(`✅ Synced new password to Firebase Auth for ${email}`);
      }
    }
  } catch (err) {
    console.error("Failed to sync password to Firebase Auth:", err);
    // We don't block the request if Firebase sync fails, since the primary DB is updated
  }

  // Delete the used token
  await db.otp.delete({ where: { id: token } });

  return ApiResponse.success({
    message: "Password has been successfully reset. You can now log in.",
  });
});
