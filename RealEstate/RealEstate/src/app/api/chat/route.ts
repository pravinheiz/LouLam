import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { UnauthorizedError, ValidationError } from "@/lib/api-errors";
import { ChatService } from "@/services/chat.service";

/**
 * POST /api/chat
 * Send a message to another user (linked to a property listing optionally).
 */
export const POST = withErrorHandler(async (request: Request) => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be logged in to send a message");
  }

  const body = await request.json();
  const { receiverId, propertyId, content } = body;

  if (!receiverId || typeof receiverId !== "string") {
    throw new ValidationError("receiverId is required and must be a string");
  }
  if (!content || typeof content !== "string") {
    throw new ValidationError("content is required and must be a string");
  }

  const message = await ChatService.sendMessage(
    session.user.id,
    receiverId,
    propertyId || null,
    content
  );

  return ApiResponse.success(message, "Message sent successfully");
});
