import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/api-errors";
import { AdminService } from "@/services/admin.service";
import { ListingStatus } from "@/types/db";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/admin/listings/[id]
 * Update listing status (approve, reject, flag).
 */
export const PATCH = withErrorHandler(async (request: Request, context: unknown) => {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const { id } = await (context as RouteParams).params;
  const body = await request.json();
  const { status } = body;

  const validStatuses: ListingStatus[] = ["ACTIVE", "PENDING", "FLAGGED", "DRAFT", "SOLD", "IN_TALK"];
  if (!status || !validStatuses.includes(status)) {
    throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const updated = await AdminService.updateListingStatus(session.user.id, id, status);
  return ApiResponse.success(updated, `Listing status updated to ${status}`);
});

/**
 * DELETE /api/admin/listings/[id]
 * Permanently delete a spam listing.
 */
export const DELETE = withErrorHandler(async (_request: Request, context: unknown) => {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const { id } = await (context as RouteParams).params;

  await AdminService.deleteListing(session.user.id, id);
  return ApiResponse.empty("Listing permanently deleted");
});
