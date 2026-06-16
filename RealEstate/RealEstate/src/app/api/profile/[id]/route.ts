import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/api-errors";
import { ListingStatus } from "@/types/db";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = {
  params: Promise<{ id: string }>;
};

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: Date;
  image: string | null;
  phone: string | null;
  phoneVerified?: boolean | null;
  bio: string | null;
  company: string | null;
  address: string | null;
  sellerVerification?: {
    status: string;
    documentUrls: string[];
    verifiedAt: Date | null;
  } | null;
}

interface MockPropertyImage {
  url: string;
}

interface MockProperty {
  id: string;
  title: string;
  description: string;
  price: number;
  address: string;
  propertyType: string;
  status: string;
  latitude: number;
  longitude: number;
  ownerId: string;
  createdAt: Date;
  images: MockPropertyImage[];
}

/**
 * GET /api/profile/[id]
 * Retrieves user details and their property listings.
 */
export const GET = withErrorHandler(async (request: Request, context: unknown) => {
  const session = await auth();
  const { id: paramId } = await (context as RouteParams).params;
  
  let targetUserId = paramId;
  let isOwnProfile = false;

  if (paramId === "me") {
    if (!session?.user?.id) {
      throw new UnauthorizedError("You must be logged in to view your profile");
    }
    targetUserId = session.user.id;
    isOwnProfile = true;
  } else {
    // Validate UUID format before querying database
    if (!UUID_REGEX.test(paramId)) {
      throw new ValidationError("Invalid user ID format");
    }
    isOwnProfile = session?.user?.id === paramId;
  }

  // Fetch user details
  let user = (await db.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      image: true,
      phone: true,
      phoneVerified: true,
      bio: true,
      company: true,
      address: true,
      sellerVerification: {
        select: {
          status: true,
          documentUrls: true,
          verifiedAt: true,
        },
      },
    },
  })) as unknown as UserProfile | null;

  if (!user) {
    throw new NotFoundError("User profile not found");
  }

  // Hide phone number from non-owner standard users
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isOwnProfile && !isAdmin) {
    user.phone = null;
    user.phoneVerified = null;
  }

  // Fetch properties listed by this user
  const properties = (await db.property.findMany({
    where: {
      ownerId: targetUserId,
      deletedAt: null,
      ...(isOwnProfile ? {} : { status: { not: ListingStatus.DRAFT } }),
    },
    include: {
      images: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })) as unknown as MockProperty[];

  // Format properties to match general client payload structure
  const formattedListings = properties.map((prop) => ({
    id: prop.id,
    title: prop.title,
    description: prop.description,
    price: prop.price,
    address: prop.address,
    propertyType: prop.propertyType,
    status: prop.status,
    latitude: prop.latitude,
    longitude: prop.longitude,
    ownerId: prop.ownerId,
    createdAt: prop.createdAt,
    images: prop.images.map((img) => img.url),
  }));

  return ApiResponse.success(
    {
      user,
      listings: formattedListings,
      isOwnProfile,
    },
    "Profile retrieved successfully"
  );
});

/**
 * PUT /api/profile/[id]
 * Updates profile details (name/email/image) for the authenticated user.
 */
export const PUT = withErrorHandler(async (request: Request, context: unknown) => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be logged in to update your profile");
  }

  const { id: paramId } = await (context as RouteParams).params;
  
  // Ensure the actor is only modifying their own profile
  if (paramId !== "me" && paramId !== session.user.id) {
    throw new UnauthorizedError("You are not authorized to update this profile");
  }

  const body = await request.json();
  const { name, email, image, phone, bio, company, address, dateOfBirth } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    throw new ValidationError("Name must be at least 2 characters");
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new ValidationError("Please provide a valid email address");
  }

  // Validate DOB if updated
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      throw new ValidationError("Invalid date of birth format");
    }
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (age < 18) {
      throw new ValidationError("You must be at least 18 years old");
    }
  }

  // Verify email uniqueness if email has changed
  if (email !== session.user.email) {
    const existing = await db.user.findFirst({
      where: {
        email,
        id: { not: session.user.id },
      },
    });
    if (existing) {
      throw new ValidationError("Email address is already in use by another account");
    }
  }

  // Check if user has an approved verification. If yes, prevent name changes!
  const verification = await db.sellerVerification.findUnique({
    where: { userId: session.user.id },
  });

  const isNameChange = name.trim() !== session.user.name;
  if (verification?.status === "APPROVED" && isNameChange) {
    throw new ValidationError("Your name is verified and locked to your government document. It cannot be updated manually.");
  }

  // Perform update
  const updatedUser = await db.user.update({
    where: { id: session.user.id },
    data: {
      name: name.trim(),
      email: email.trim(),
      image: image !== undefined ? image : undefined,
      phone: phone !== undefined ? (phone ? phone.trim() : null) : undefined,
      bio: bio !== undefined ? (bio ? bio.trim() : null) : undefined,
      company: company !== undefined ? (company ? company.trim() : null) : undefined,
      address: address !== undefined ? (address ? address.trim() : null) : undefined,
      dateOfBirth: dateOfBirth !== undefined ? (dateOfBirth ? dateOfBirth.trim() : null) : undefined,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      phone: true,
      bio: true,
      company: true,
      address: true,
      dateOfBirth: true,
      updatedAt: true,
    },
  });

  return ApiResponse.success(updatedUser, "Profile updated successfully");
});
