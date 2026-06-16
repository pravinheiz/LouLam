import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { ForbiddenError, UnauthorizedError } from "@/lib/api-errors";
import { AdminService } from "@/services/admin.service";

/**
 * GET /api/admin/reports
 * Returns all user-submitted content reports for admin review.
 */
export const GET = withErrorHandler(async () => {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const reports = await AdminService.getReports();
  return ApiResponse.success(reports, "Reports retrieved");
});
