import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { UnauthorizedError, ValidationError } from "@/lib/api-errors";
import { ChatService } from "@/services/chat.service";

/**
 * GET /api/chat/messages
 * Fetch message history between the current user and another participant,
 * scoped optionally by property context. Supports timestamp delta filters for polling.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be logged in to fetch messages");
  }

  const { searchParams } = new URL(request.url);
  const otherId = searchParams.get("otherId");
  const propertyId = searchParams.get("propertyId");
  const since = searchParams.get("since") || undefined;

  if (!otherId || typeof otherId !== "string") {
    throw new ValidationError("otherId parameter is required");
  }

  const messages = await ChatService.getMessages(
    session.user.id,
    otherId,
    propertyId || null,
    since
  );

  return ApiResponse.success(messages, "Messages retrieved successfully");
});
