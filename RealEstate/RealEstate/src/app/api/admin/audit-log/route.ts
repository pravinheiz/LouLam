import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { ForbiddenError, UnauthorizedError } from "@/lib/api-errors";
import { AdminService } from "@/services/admin.service";

/**
 * GET /api/admin/audit-log
 * Returns the immutable audit log of all admin actions.
 */
export const GET = withErrorHandler(async () => {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const logs = await AdminService.getAuditLog();
  return ApiResponse.success(logs, "Audit log retrieved");
});
