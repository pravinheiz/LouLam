import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/api-errors";
import { AdminService } from "@/services/admin.service";
import { VerificationStatus } from "@/types/db";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/admin/sellers/[id]
 * Approve or reject a seller verification (id = userId).
 */
export const PATCH = withErrorHandler(async (request: Request, context: unknown) => {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const { id: userId } = await (context as RouteParams).params;
  const body = await request.json();
  const { status } = body;

  const validStatuses: VerificationStatus[] = ["APPROVED", "REJECTED", "PENDING"];
  if (!status || !validStatuses.includes(status)) {
    throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const updated = await AdminService.updateVerification(session.user.id, userId, status);
  return ApiResponse.success(updated, `Seller verification ${status.toLowerCase()}`);
});
