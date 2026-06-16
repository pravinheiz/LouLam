import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { ForbiddenError, UnauthorizedError } from "@/lib/api-errors";
import { AdminService } from "@/services/admin.service";

/**
 * GET /api/admin/stats
 * Returns dashboard statistics for the admin panel.
 */
export const GET = withErrorHandler(async () => {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const stats = await AdminService.getDashboardStats();
  return ApiResponse.success(stats, "Dashboard stats retrieved");
});
