import { NextResponse } from "next/server";

export interface StandardResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> extends StandardResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ApiResponse {
  /**
   * Send a standard success response
   */
  static success<T>(data: T, message?: string, status = 200): NextResponse<StandardResponse<T>> {
    return NextResponse.json(
      {
        success: true,
        message,
        data,
      },
      { status }
    );
  }

  /**
   * Send a standard created (201) response
   */
  static created<T>(data: T, message = "Resource created successfully"): NextResponse<StandardResponse<T>> {
    return NextResponse.json(
      {
        success: true,
        message,
        data,
      },
      { status: 201 }
    );
  }

  /**
   * Send a standard empty/nocontent success response (e.g. 204 or 200 with message)
   */
  static empty(message = "Action completed successfully", status = 200): NextResponse<StandardResponse<null>> {
    return NextResponse.json(
      {
        success: true,
        message,
      },
      { status }
    );
  }

  /**
   * Send a standardized paginated response
   */
  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message?: string
  ): NextResponse<PaginatedResponse<T>> {
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json(
      {
        success: true,
        message,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
      { status: 200 }
    );
  }

  /**
   * Send a standard error response (used as a fallback, with-error-handler is preferred)
   */
  static error(
    message: string,
    status = 400,
    errors?: Record<string, string[]>
  ): NextResponse<StandardResponse<null>> {
    return NextResponse.json(
      {
        success: false,
        message,
        errors,
      },
      { status }
    );
  }
}
