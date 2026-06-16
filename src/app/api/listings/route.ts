import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { UnauthorizedError } from "@/lib/api-errors";
import { ListingsService } from "@/services/listings.service";
import { NextResponse } from "next/server";

/**
 * GET /api/listings
 * Fetch and filter listings, supporting PostGIS radial and bounding box queries.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  
  // Parse query parameters
  const queryParams = Object.fromEntries(searchParams.entries());
  
  // Retrieve listings using the service layer
  const { listings, nextCursor, hasNextPage, limit } = await ListingsService.getListings(queryParams);

  return NextResponse.json({
    success: true,
    message: "Listings retrieved successfully",
    data: listings,
    pagination: {
      nextCursor,
      hasNextPage,
      limit,
    }
  });
});

/**
 * POST /api/listings
 * Create a new listing (requires authentication).
 */
export const POST = withErrorHandler(async (request: Request) => {
  // Check auth session
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be logged in to create a listing");
  }



  // Parse body
  const body = await request.json();
  
  // Validate and create listing
  const listing = await ListingsService.createListing(session.user.id, body);

  return ApiResponse.created(listing, "Listing created successfully");
});
