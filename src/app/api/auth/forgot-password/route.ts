import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mail";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import crypto from "crypto";

const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const { email } = ForgotPasswordSchema.parse(body);

  const cleanEmail = email.trim().toLowerCase();

  // Find user
  const user = await db.user.findFirst({
    where: { email: cleanEmail },
  });

  // To prevent email enumeration, we always return a success message
  // even if the user is not found.
  if (user) {
    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    // Store the token in the OTP collection
    await db.otp.create({
      data: {
        id: token,
        email: cleanEmail,
        type: "PASSWORD_RESET",
        expiresAt,
      },
    });

    // Send the email
    await sendPasswordResetEmail(cleanEmail, token);
  }

  return ApiResponse.success({
    message: "If an account exists with that email, a password reset link has been sent.",
  });
});
