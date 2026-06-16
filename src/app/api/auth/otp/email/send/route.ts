import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { ValidationError } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { sendEmailOtp } from "@/lib/mail";

/**
 * POST /api/auth/otp/email/send
 * Generates and sends a 6-digit email OTP verification code.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const { email } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new ValidationError("A valid email address is required");
  }

  const cleanedEmail = email.trim().toLowerCase();

  // Check for email duplication in user profiles
  const existingUser = await db.user.findFirst({
    where: { email: cleanedEmail },
  });
  if (existingUser) {
    throw new ValidationError("Email address is already in use by another account");
  }

  // Generate 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Calculate expiration (5 minutes from now)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Clear any existing active OTP entries for this email
  try {
    await db.otp.deleteMany({ where: { email: cleanedEmail } });
  } catch (err) {
    console.warn("Warning clearing old OTP records:", err);
  }

  // Create new OTP record
  await db.otp.create({
    data: {
      email: cleanedEmail,
      code,
      expiresAt,
    },
  });

  // Dispatch Email
  await sendEmailOtp(cleanedEmail, code);

  return ApiResponse.success(
    {
      email: cleanedEmail,
      expiresIn: "300s",
    },
    "Verification code sent successfully to your email"
  );
});
