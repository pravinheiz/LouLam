import { db } from "@/lib/db";
import { z } from "zod";
import { NotFoundError, ValidationError } from "@/lib/api-errors";
import { SpatialService } from "./spatial.service";

export const PropertyType = {
  HOUSE: "HOUSE",
  APARTMENT: "APARTMENT",
  CONDO: "CONDO",
  LAND: "LAND",
  COMMERCIAL: "COMMERCIAL",
} as const;
export type PropertyType = typeof PropertyType[keyof typeof PropertyType];

export const ListingStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  PENDING: "PENDING",
  SOLD: "SOLD",
  RENTED: "RENTED",
  FLAGGED: "FLAGGED",
  IN_TALK: "IN_TALK",
} as const;
export type ListingStatus = typeof ListingStatus[keyof typeof ListingStatus];

// Property/Listing Zod schemas
export const CreateListingSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.number().positive("Price must be a positive number"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  propertyType: z.nativeEnum(PropertyType),
  status: z.nativeEnum(ListingStatus).optional().default(ListingStatus.ACTIVE),
  images: z.array(z.string()).min(1, "At least one image is required"),
  imageHashes: z.array(z.string()).min(1, "Image hashes are required"),
  documentUrl: z.string(),
  documentHash: z.string().min(1, "Document hash is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  polygonWkt: z.string().optional(),
  createdAt: z.string().optional(),
  lastReminderSentAt: z.string().nullable().optional(),
});

export const UpdateListingSchema = CreateListingSchema.partial();

export const ListingQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().default(10),
  propertyType: z.nativeEnum(PropertyType).optional(),
  status: z.nativeEnum(ListingStatus).optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minArea: z.coerce.number().positive().optional(),
  maxArea: z.coerce.number().positive().optional(),
  
  // Radial Search
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().optional().default(5000), // meters

  // Bounding Box (Viewport) Search
  south: z.coerce.number().min(-90).max(90).optional(),
  west: z.coerce.number().min(-180).max(180).optional(),
  north: z.coerce.number().min(-90).max(90).optional(),
  east: z.coerce.number().min(-180).max(180).optional(),
  ownerId: z.string().optional(),
});

export type CreateListingInput = z.infer<typeof CreateListingSchema>;
export type UpdateListingInput = z.infer<typeof UpdateListingSchema>;
export type ListingQueryInput = z.infer<typeof ListingQuerySchema>;

export interface RawPropertyResult {
  id: string;
  title: string;
  description: string;
  price: number;
  address: string;
  propertyType: PropertyType;
  status: ListingStatus;
  latitude: number;
  longitude: number;
  ownerId: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  createdAt: Date;
  updatedAt: Date;
  images: string[];
  polygon: {
    type: "Polygon";
    coordinates: number[][][];
  } | null;
}

// Utility to parse WKT POLYGON to coordinate arrays
function parseWktPolygon(wkt: string): [number, number][][] | null {
  const matches = wkt.match(/POLYGON\s*\(\s*\(([^)]+)\)\s*\)/i);
  if (!matches) return null;
  const coords = matches[1].split(",").map((pair) => {
    const [lng, lat] = pair.trim().split(/\s+/).map(Number);
    return [lng, lat] as [number, number];
  });
  return [coords];
}

export class ListingsService {
  /**
   * Create a property listing
   */
  static async createListing(ownerId: string, input: CreateListingInput) {
    const { images, imageHashes, polygonWkt, ...rest } = CreateListingSchema.parse(input);

    // 1. Check duplicate document
    const duplicateDoc = await db.property.findFirst({
      where: { documentHash: rest.documentHash, deletedAt: null },
    });
    if (duplicateDoc) {
      throw new ValidationError(
        "This property document has already been uploaded for another listing. Duplicate listings are not allowed."
      );
    }

    // 2. Check duplicate images
    if (imageHashes && imageHashes.length > 0) {
      for (const imgHash of imageHashes) {
        if (!imgHash) continue;
        const duplicateImg = await db.propertyImage.findFirst({
          where: { hash: imgHash },
        });
        if (duplicateImg) {
          // Check if parent property is not deleted
          const parentProp = await db.property.findUnique({
            where: { id: duplicateImg.propertyId },
          });
          if (parentProp && parentProp.deletedAt === null) {
            throw new ValidationError(
              "One or more property images have already been uploaded for another listing. Duplicate listings are not allowed."
            );
          }
        }
      }
    }

    const property = await db.property.create({
      data: {
        ...rest,
        ownerId,
        deletedAt: null,
      },
    });

    // Save images
    for (let i = 0; i < images.length; i++) {
      await db.propertyImage.create({
        data: {
          propertyId: property.id,
          url: images[i],
          order: i,
          hash: imageHashes ? imageHashes[i] || "" : "",
        },
      });
    }

    // Save boundary polygon
    if (polygonWkt) {
      const parsedCoords = parseWktPolygon(polygonWkt);
      if (parsedCoords) {
        await SpatialService.savePolygon(property.id, parsedCoords);
      }
    }

    return property;
  }

  /**
   * Get a property by its ID
   */
  static async getListingById(id: string) {
    const property = await db.property.findUnique({
      where: { id },
    });

    if (!property || property.deletedAt) {
      throw new NotFoundError("Property listing not found");
    }

    // Fetch owner details
    const owner = await db.user.findUnique({
      where: { id: property.ownerId },
    });

    // Fetch images
    const dbImages = await db.propertyImage.findMany({
      where: { propertyId: id },
      orderBy: { order: "asc" },
    });

    // Fetch polygon
    const polygonDoc = await db.propertyPolygon.findUnique({
      where: { propertyId: id },
    });

    const polygon = polygonDoc?.coordinates
      ? { type: "Polygon", coordinates: polygonDoc.coordinates }
      : null;

    const areaSqMeters = await SpatialService.getPolygonArea(id);
    const areaSqft = areaSqMeters ? Math.round(areaSqMeters * 10.763910416712 * 100) / 100 : null;

    return {
      ...property,
      owner: owner
        ? {
            id: owner.id,
            name: owner.name,
            email: owner.email,
            role: owner.role,
            image: owner.image,
            phone: owner.phone,
            sellerVerification: null,
          }
        : null,
      images: dbImages.map((img: any) => img.url),
      imageHashes: dbImages.map((img: any) => img.hash || ""),
      polygon,
      areaSqft,
    };
  }

  /**
   * Update an existing property listing
   */
  static async updateListing(id: string, ownerId: string, input: UpdateListingInput) {
    const { images, imageHashes, polygonWkt, ...validated } = UpdateListingSchema.parse(input);

    const property = await db.property.findUnique({
      where: { id },
    });

    if (!property || property.deletedAt) {
      throw new NotFoundError("Property listing not found");
    }

    if (property.ownerId !== ownerId) {
      throw new ValidationError("You do not have permission to update this listing");
    }

    // 1. Check duplicate document (excluding current listing)
    if (validated.documentHash) {
      const duplicateDoc = await db.property.findFirst({
        where: { documentHash: validated.documentHash, deletedAt: null },
      });
      if (duplicateDoc && duplicateDoc.id !== id) {
        throw new ValidationError(
          "This property document has already been uploaded for another listing. Duplicate listings are not allowed."
        );
      }
    }

    // 2. Check duplicate images (excluding current listing)
    if (imageHashes && imageHashes.length > 0) {
      for (const imgHash of imageHashes) {
        if (!imgHash) continue;
        const duplicateImg = await db.propertyImage.findFirst({
          where: { hash: imgHash },
        });
        if (duplicateImg && duplicateImg.propertyId !== id) {
          // Check if parent property is not deleted
          const parentProp = await db.property.findUnique({
            where: { id: duplicateImg.propertyId },
          });
          if (parentProp && parentProp.deletedAt === null) {
            throw new ValidationError(
              "One or more property images have already been uploaded for another listing. Duplicate listings are not allowed."
            );
          }
        }
      }
    }

    const updated = await db.property.update({
      where: { id },
      data: validated,
    });

    if (images) {
      await db.propertyImage.deleteMany({
        where: { propertyId: id },
      });
      for (let i = 0; i < images.length; i++) {
        await db.propertyImage.create({
          data: {
            propertyId: id,
            url: images[i],
            order: i,
            hash: imageHashes ? imageHashes[i] || "" : "",
          },
        });
      }
    }

    if (polygonWkt !== undefined) {
      await db.propertyPolygon.deleteMany({
        where: { propertyId: id },
      });
      if (polygonWkt) {
        const parsedCoords = parseWktPolygon(polygonWkt);
        if (parsedCoords) {
          await SpatialService.savePolygon(id, parsedCoords);
        }
      }
    }

    return updated;
  }

  /**
   * Delete a property listing
   */
  static async deleteListing(id: string, ownerId: string) {
    const property = await db.property.findUnique({
      where: { id },
    });

    if (!property || property.deletedAt) {
      throw new NotFoundError("Property listing not found");
    }

    if (property.ownerId !== ownerId) {
      throw new ValidationError("You do not have permission to delete this listing");
    }

    await db.property.update({
      where: { id },
      data: {
        deletedAt: new Date().toISOString(),
      },
    });

    return true;
  }

  /**
   * Search and filter listings with support for spatial TS calculations
   */
  static async getListings(queryInput: unknown) {
    const filters = ListingQuerySchema.parse(queryInput);
    const {
      cursor,
      limit,
      propertyType,
      status,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      lat,
      lng,
      radius,
      south,
      west,
      north,
      east,
      ownerId,
    } = filters;

    // 1. Fetch all properties
    let properties = await db.property.findMany();

    // 2. Apply initial synchronous filters in memory
    properties = properties.filter((p: any) => {
      if (p.deletedAt) return false;

      // Status filter (exclude drafts by default)
      if (status) {
        if (p.status !== status) return false;
      } else {
        if (p.status === "DRAFT") return false;
      }

      if (propertyType && p.propertyType !== propertyType) return false;
      if (ownerId && p.ownerId !== ownerId) return false;

      if (minPrice !== undefined && p.price < minPrice) return false;
      if (maxPrice !== undefined && p.price > maxPrice) return false;

      // Viewport bounds filter
      if (south !== undefined && west !== undefined && north !== undefined && east !== undefined) {
        const withinBounds =
          p.latitude >= south &&
          p.latitude <= north &&
          p.longitude >= west &&
          p.longitude <= east;
        if (!withinBounds) return false;
      }

      return true;
    });

    // 3. Apply radial/distance spatial filters in memory
    if (lat !== undefined && lng !== undefined && radius !== undefined) {
      const fromPoint = { latitude: lat, longitude: lng };
      const filtered: any[] = [];
      for (const p of properties) {
        const dist = await SpatialService.calculateDistance(fromPoint, {
          latitude: p.latitude,
          longitude: p.longitude,
        });
        if (dist <= radius) {
          (p as any).distanceMeters = dist;
          filtered.push(p);
        }
      }
      properties = filtered;
    }

    // 4. Apply area filters in memory
    if (minArea !== undefined || maxArea !== undefined) {
      const filtered: any[] = [];
      for (const p of properties) {
        const areaSqM = await SpatialService.getPolygonArea(p.id);
        const areaSqft = areaSqM * 10.763910416712;
        let match = true;
        if (minArea !== undefined && areaSqft < minArea) match = false;
        if (maxArea !== undefined && areaSqft > maxArea) match = false;
        if (match) filtered.push(p);
      }
      properties = filtered;
    }

    // 5. Sort properties by createdAt DESC, id DESC
    properties.sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });

    // 6. Apply cursor pagination
    let startIndex = 0;
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, "base64").toString("utf-8");
        const parts = decoded.split("_");
        if (parts.length === 2) {
          const [createdAtStr, id] = parts;
          const cursorTime = new Date(createdAtStr).getTime();
          
          const foundIndex = properties.findIndex((p: any) => {
            const pTime = new Date(p.createdAt).getTime();
            return pTime < cursorTime || (pTime === cursorTime && p.id < id);
          });
          if (foundIndex !== -1) {
            startIndex = foundIndex;
          }
        }
      } catch (err) {
        console.error("Failed to decode cursor:", err);
      }
    }

    const sliced = properties.slice(startIndex, startIndex + limit + 1);
    const hasNextPage = sliced.length > limit;
    const items = hasNextPage ? sliced.slice(0, limit) : sliced;

    let nextCursor: string | null = null;
    if (hasNextPage && items.length > 0) {
      const lastItem = items[items.length - 1];
      const cursorString = `${lastItem.createdAt}_${lastItem.id}`;
      nextCursor = Buffer.from(cursorString, "utf-8").toString("base64");
    }

    // 7. Hydrate owners and images
    const hydratedListings = await Promise.all(
      items.map(async (p: any) => {
        const owner = await db.user.findUnique({ where: { id: p.ownerId } });
        const dbImages = await db.propertyImage.findMany({
          where: { propertyId: p.id },
          orderBy: { order: "asc" },
        });
        const polygonDoc = await db.propertyPolygon.findUnique({
          where: { propertyId: p.id },
        });
        const areaSqMeters = await SpatialService.getPolygonArea(p.id);
        const areaSqft = areaSqMeters ? Math.round(areaSqMeters * 10.763910416712) : null;

        return {
          id: p.id,
          title: p.title,
          description: p.description,
          price: p.price,
          address: p.address,
          propertyType: p.propertyType,
          status: p.status,
          latitude: p.latitude,
          longitude: p.longitude,
          ownerId: p.ownerId,
          ownerName: owner?.name || null,
          ownerPhone: owner?.phone || null,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
          images: dbImages.map((img: any) => img.url),
          polygon: polygonDoc?.coordinates
            ? { type: "Polygon", coordinates: polygonDoc.coordinates }
            : null,
          areaSqft,
        };
      })
    );

    return {
      listings: hydratedListings,
      nextCursor,
      hasNextPage,
      limit,
    };
  }
}
