import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { UnauthorizedError } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { sendPropertyStatusReminder } from "@/lib/mail";
import crypto from "crypto";

export const POST = withErrorHandler(async (request: Request) => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be logged in to perform reminder check");
  }

  const userId = session.user.id;
  const now = new Date();
  const sixtyDaysInMs = 60 * 24 * 60 * 60 * 1000;

  // Fetch all user listings
  let userProperties = await db.property.findMany({
    where: { ownerId: userId },
  });

  // Filter listings: must be ACTIVE or IN_TALK, and not deleted
  userProperties = userProperties.filter((p: any) => {
    return !p.deletedAt && (p.status === "ACTIVE" || p.status === "IN_TALK");
  });

  const expiredProperties: any[] = [];

  for (const prop of userProperties) {
    const createdAtTime = new Date(prop.createdAt).getTime();
    
    // Check if property is older than 60 days
    if (now.getTime() - createdAtTime > sixtyDaysInMs) {
      expiredProperties.push(prop);

      // Check if reminder was sent within the last 60 days
      const lastSentStr = prop.lastReminderSentAt;
      const lastSentTime = lastSentStr ? new Date(lastSentStr).getTime() : 0;

      if (!lastSentStr || now.getTime() - lastSentTime > sixtyDaysInMs) {
        const owner = await db.user.findUnique({ where: { id: userId } });
        const email = owner?.email || session.user.email;
        const name = owner?.name || "Property Owner";

        if (email) {
          const token = crypto
            .createHmac("sha256", process.env.NEXTAUTH_SECRET || "secret")
            .update(`${prop.id}:${userId}`)
            .digest("hex");

          // Send email in background
          sendPropertyStatusReminder(email, name, prop.id, prop.title, token).catch((err) => {
            console.error("Failed to send property status reminder email:", err);
          });

          // Record last reminder timestamp in DB
          await db.property.update({
            where: { id: prop.id },
            data: { lastReminderSentAt: now.toISOString() },
          });
        }
      }
    }
  }

  return ApiResponse.success(expiredProperties, "Reminder check completed");
});
