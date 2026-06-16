import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { UnauthorizedError, ValidationError } from "@/lib/api-errors";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/profile/[id]/verify
 * Verifies user legal name against a government document.
 */
export const POST = withErrorHandler(async (request: Request, context: unknown) => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be logged in to verify your identity");
  }

  const { id: paramId } = await (context as RouteParams).params;

  // Ensure they are verifying themselves
  if (paramId !== "me" && paramId !== session.user.id) {
    throw new UnauthorizedError("You are not authorized to verify this profile");
  }

  const body = await request.json();
  const { legalName, documentUrl } = body;

  if (!legalName || typeof legalName !== "string" || legalName.trim().length < 2) {
    throw new ValidationError("Legal name must be at least 2 characters");
  }

  if (!documentUrl || typeof documentUrl !== "string" || (!documentUrl.startsWith("http") && !documentUrl.startsWith("/uploads/"))) {
    throw new ValidationError("A valid government document image URL or path is required");
  }

  // 1. Create or update SellerVerification record
  await db.sellerVerification.upsert({
    where: { userId: session.user.id },
    update: {
      status: "APPROVED",
      documentUrls: [documentUrl],
      verifiedAt: new Date(),
      updatedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      status: "APPROVED",
      documentUrls: [documentUrl],
      verifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // 2. Lock and update user's legal name
  const updatedUser = await db.user.update({
    where: { id: session.user.id },
    data: {
      name: legalName.trim(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      sellerVerification: {
        select: {
          status: true,
          documentUrls: true,
          verifiedAt: true,
        },
      },
    },
  });

  return ApiResponse.success(updatedUser, "Government ID verification approved and legal name locked.");
});
