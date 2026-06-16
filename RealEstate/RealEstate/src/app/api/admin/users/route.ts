import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/types/db";

/**
 * GET /api/admin/users
 * Fetches all registered users for administration.
 * Restriced to users with ADMIN role.
 */
export const GET = withErrorHandler(async () => {
  const session = await auth();
  if (!session || session.user?.role !== Role.ADMIN) {
    return ApiResponse.error("Unauthorized. Admin privileges required.", 401);
  }

  const users = await db.user.findMany();

  // Sort users so online / active users appear first, then sorted alphabetically by name
  users.sort((a: any, b: any) => {
    const timeA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
    const timeB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
    
    if (timeB !== timeA) {
      return timeB - timeA; // Most recently active first
    }
    return (a.name || "").localeCompare(b.name || "");
  });

  return ApiResponse.success(users, "Users list retrieved successfully");
});

/**
 * PATCH /api/admin/users
 * Updates a user's status (e.g. status = "ACTIVE" | "BANNED" | "FLAGGED").
 * Restricted to ADMIN role.
 */
export const PATCH = withErrorHandler(async (request: Request) => {
  const session = await auth();
  if (!session || session.user?.role !== Role.ADMIN) {
    return ApiResponse.error("Unauthorized. Admin privileges required.", 401);
  }

  const body = await request.json();
  const { userId, status } = body;

  if (!userId || !status) {
    return ApiResponse.error("Missing userId or status", 400);
  }

  if (status !== "ACTIVE" && status !== "BANNED" && status !== "FLAGGED") {
    return ApiResponse.error("Invalid status value", 400);
  }

  // Update in DB
  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { status },
  });

  return ApiResponse.success(updatedUser, `User status updated to ${status}`);
});

