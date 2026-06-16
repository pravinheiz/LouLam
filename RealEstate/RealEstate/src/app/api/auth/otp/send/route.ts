import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { ValidationError } from "@/lib/api-errors";
import { db } from "@/lib/db";

/**
 * POST /api/auth/otp/send
 * Checks phone number availability and validates Firebase settings.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const { phone } = body;

  if (!phone || typeof phone !== "string" || phone.trim().length < 10) {
    throw new ValidationError("A valid mobile number is required");
  }

  const cleanedPhone = phone.trim();

  // Check for phone number duplication in user profiles
  const existingUser = await db.user.findFirst({
    where: { phone: cleanedPhone },
  });
  if (existingUser) {
    throw new ValidationError("Phone number is already in use by another profile");
  }

  const apiKey = process.env.FIREBASE_API_KEY;
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const isConfigured = !!(apiKey && authDomain && projectId);

  if (!isConfigured) {
    throw new ValidationError("Firebase Phone Authentication is not configured in the environment. Please check your .env file.");
  }

  return ApiResponse.success(
    {
      phone: cleanedPhone,
      status: "available",
    },
    "Phone number is available for verification"
  );
});
