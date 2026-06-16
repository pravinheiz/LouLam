import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { UnauthorizedError, ValidationError, NotFoundError } from "@/lib/api-errors";

/**
 * POST /api/report
 * Public (authenticated) endpoint for any user to report a listing.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be logged in to report a listing");
  }

  const body = await request.json();
  const { propertyId, reason } = body;

  if (!propertyId || typeof propertyId !== "string") {
    throw new ValidationError("A valid property ID is required");
  }

  if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
    throw new ValidationError("Reason must be at least 10 characters");
  }

  // Check property exists
  const property = await db.property.findUnique({ where: { id: propertyId } });
  if (!property) {
    throw new NotFoundError("Property not found");
  }

  // Prevent duplicate reports by same user on same property
  const existing = await db.report.findFirst({
    where: {
      reporterId: session.user.id,
      propertyId,
      status: "PENDING",
    },
  });

  if (existing) {
    return ApiResponse.success(existing, "You have already reported this listing");
  }

  const report = await db.report.create({
    data: {
      reporterId: session.user.id,
      propertyId,
      reason: reason.trim(),
    },
  });

  return ApiResponse.created(report, "Report submitted successfully");
});
