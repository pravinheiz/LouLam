import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/user/heartbeat
 * Heartbeat presence ping. Updates the authenticated user's lastActiveAt field.
 */
export const POST = withErrorHandler(async () => {
  const session = await auth();
  if (!session?.user?.email) {
    return ApiResponse.error("Unauthorized", 401);
  }

  const email = session.user.email.trim().toLowerCase();

  // Find user by email first (since FirestoreCollection update expects id or userId)
  const user = await db.user.findFirst({
    where: { email },
  });

  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: {
        lastActiveAt: new Date().toISOString(),
      },
    });
  }

  return ApiResponse.success({ updated: true }, "User status updated");
});
