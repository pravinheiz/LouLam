import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { UnauthorizedError } from "@/lib/api-errors";
import { ChatService } from "@/services/chat.service";

/**
 * GET /api/chat/conversations
 * Fetch all active conversation threads for the current user.
 */
export const GET = withErrorHandler(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be logged in to view conversations");
  }

  const conversations = await ChatService.getConversations(session.user.id);

  return ApiResponse.success(conversations, "Conversations retrieved successfully");
});
