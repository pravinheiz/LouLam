import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { UnauthorizedError, ForbiddenError } from "@/lib/api-errors";
import { ListingsService } from "@/services/listings.service";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/listings/[id]
 * Fetch details of a specific property listing.
 * Draft listings are restricted to their owner.
 */
export const GET = withErrorHandler(async (request: Request, context: unknown) => {
  const { id } = await (context as RouteParams).params;
  const listing = await ListingsService.getListingById(id);

  if (listing.status === "DRAFT") {
    const session = await auth();
    if (!session?.user?.id || session.user.id !== listing.ownerId) {
      throw new ForbiddenError("You are not authorized to view this draft listing");
    }
  }

  return ApiResponse.success(listing, "Listing retrieved successfully");
});

/**
 * PUT /api/listings/[id]
 * Update an existing property listing (restricted to the owner).
 */
export const PUT = withErrorHandler(async (request: Request, context: unknown) => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be logged in to update a listing");
  }

  const { id } = await (context as RouteParams).params;
  const body = await request.json();

  const updatedListing = await ListingsService.updateListing(id, session.user.id, body);

  return ApiResponse.success(updatedListing, "Listing updated successfully");
});

/**
 * DELETE /api/listings/[id]
 * Soft-delete an existing property listing (restricted to the owner).
 */
export const DELETE = withErrorHandler(async (request: Request, context: unknown) => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be logged in to delete a listing");
  }

  const { id } = await (context as RouteParams).params;
  await ListingsService.deleteListing(id, session.user.id);

  return ApiResponse.success(null, "Listing deleted successfully");
});
