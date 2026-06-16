import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { ValidationError } from "@/lib/api-errors";
import { db } from "@/lib/db";

/**
 * POST /api/auth/otp/email/verify
 * Validates a verification code for an email address.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const { email, code } = body;

  if (!email || typeof email !== "string") {
    throw new ValidationError("Email address is required");
  }
  if (!code || typeof code !== "string" || code.trim().length !== 6) {
    throw new ValidationError("A 6-digit verification code is required");
  }

  const cleanedEmail = email.trim().toLowerCase();
  const cleanedCode = code.trim();

  // Find the OTP record
  const record = await db.otp.findFirst({
    where: {
      email: cleanedEmail,
      code: cleanedCode,
    },
  });

  if (!record) {
    throw new ValidationError("Invalid email verification code");
  }

  // Check expiration
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    throw new ValidationError("Verification code has expired. Please send a new one.");
  }

  return ApiResponse.success(
    {
      email: cleanedEmail,
      verified: true,
    },
    "Email address verified successfully"
  );
});
