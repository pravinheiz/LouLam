import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { ForbiddenError, UnauthorizedError } from "@/lib/api-errors";
import { AdminService } from "@/services/admin.service";

/**
 * GET /api/admin/sellers
 * Returns all seller verification records for admin review.
 */
export const GET = withErrorHandler(async () => {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const verifications = await AdminService.getVerifications();
  return ApiResponse.success(verifications, "Seller verifications retrieved");
});
