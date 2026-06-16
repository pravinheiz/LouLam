import { withErrorHandler } from "@/lib/with-error-handler";
import { ValidationError } from "@/lib/api-errors";

/**
 * POST /api/auth/otp/verify
 * Deprecated endpoint for phone OTP verification.
 */
export const POST = withErrorHandler(async () => {
  throw new ValidationError("Direct server-side verification code checking is deprecated. Please verify your phone number using Firebase client-side authentication.");
});
