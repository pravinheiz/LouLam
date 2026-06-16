import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { AuthService } from "@/services/auth.service";

/**
 * POST /api/auth/register
 * Register a new user account.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const body = await request.json();
  
  const user = await AuthService.registerUser(body);

  return ApiResponse.created(user, "User registered successfully");
});
