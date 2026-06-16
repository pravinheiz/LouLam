import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { ConflictError } from "@/lib/api-errors";
import { db } from "@/lib/db";

/**
 * POST /api/auth/check-duplicate
 * Checks if email or phone is already registered in the database.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  const { email, phone } = body;

  if (email) {
    const cleanedEmail = email.trim().toLowerCase();
    const existingEmail = await db.user.findFirst({
      where: { email: cleanedEmail },
    });
    if (existingEmail) {
      throw new ConflictError("Email address is already in use");
    }
  }

  if (phone) {
    const cleanedPhone = phone.trim();
    const existingPhone = await db.user.findFirst({
      where: { phone: cleanedPhone },
    });
    if (existingPhone) {
      throw new ConflictError("Phone number is already in use by another profile");
    }
  }

  return ApiResponse.success({ available: true }, "Credentials are available");
});
