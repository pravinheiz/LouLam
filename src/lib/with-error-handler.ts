import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./api-errors";
import { ApiResponse } from "./api-response";

type RouteHandler = (
  request: NextRequest | Request,
  context: unknown
) => Promise<NextResponse> | NextResponse;

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest | Request, context: unknown) => {
    try {
      return await handler(request, context);
    } catch (error: unknown) {
      console.error("🌐 API Handler Error:", error);

      // Handle custom API errors
      if (error instanceof ApiError) {
        return ApiResponse.error(error.message, error.statusCode, error.errors);
      }

      // Handle Zod schema validation errors
      if (error instanceof ZodError) {
        const fieldErrors: Record<string, string[]> = {};
        
        error.issues.forEach((issue) => {
          const path = issue.path.join(".");
          if (path) {
            if (!fieldErrors[path]) {
              fieldErrors[path] = [];
            }
            fieldErrors[path].push(issue.message);
          }
        });

        return ApiResponse.error(
          "Validation failed",
          400,
          fieldErrors
        );
      }

      // Prisma database unique constraints or other prisma-specific errors
      const err = error as { code?: string; meta?: { target?: string[] } };
      if (err.code && typeof err.code === "string" && err.code.startsWith("P")) {
        // e.g. Prisma unique constraint violation (P2002)
        if (err.code === "P2002") {
          const targets = err.meta?.target || ["field"];
          const fieldErrors: Record<string, string[]> = {};
          targets.forEach((field) => {
            fieldErrors[field] = [`This ${field} is already in use`];
          });
          return ApiResponse.error("Resource conflict", 409, fieldErrors);
        }
        
        if (err.code === "P2025") {
          return ApiResponse.error("Resource not found", 404);
        }
      }

      // Handle standard JS errors
      const message =
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : (error as Error).message || "Internal server error";

      return ApiResponse.error(message, 500);
    }
  };
}
