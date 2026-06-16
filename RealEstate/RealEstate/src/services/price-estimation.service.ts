import { db } from "@/lib/db";
import { PropertyType } from "@/types/db";
import { SpatialService } from "./spatial.service";

export interface EstimationResult {
  estimatedPrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  avgPricePerSqft: number;
  radiusMetersUsed: number;
  comparableCount: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

interface RawQueryListing {
  id: string;
  title: string;
  price: number;
  areaSqft: number;
  pricePerSqft: number;
  distanceMeters: number;
  isVerified: boolean;
}

export class PriceEstimationService {
  /**
   * Estimate the valuation of a property of a specific type and size at a given location.
   */
  static async estimatePrice(
    latitude: number,
    longitude: number,
    propertyType: PropertyType,
    targetAreaSqft: number
  ): Promise<EstimationResult> {
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error("Invalid coordinate parameters");
    }
    if (targetAreaSqft <= 0) {
      throw new Error("Target area must be a positive number");
    }

    const searchRadii = [2000, 5000, 10000]; // 2km, 5km, 10km
    let listings: RawQueryListing[] = [];
    let radiusUsed = 2000;

    // 1. Fetch candidate properties of the requested type
    const candidateProperties = await db.property.findMany({
      where: {
        status: "ACTIVE",
        propertyType: propertyType,
      },
    });

    const activeCandidates = candidateProperties.filter((p) => !p.deletedAt);

    // 2. Resolve spatial measurements (distance, area) and verifications
    const resolvedCandidates: RawQueryListing[] = [];
    for (const prop of activeCandidates) {
      const distance = await SpatialService.calculateDistance(
        { latitude, longitude },
        { latitude: prop.latitude, longitude: prop.longitude }
      );

      const areaSqMeters = await SpatialService.getPolygonArea(prop.id);
      if (areaSqMeters <= 0) continue; // Skip if no boundary polygon or area is 0

      const areaSqft = areaSqMeters * 10.763910416712;

      const verification = await db.sellerVerification.findFirst({
        where: { userId: prop.ownerId },
      });
      const isVerified = verification?.status === "APPROVED";

      resolvedCandidates.push({
        id: prop.id,
        title: prop.title,
        price: prop.price,
        areaSqft,
        pricePerSqft: prop.price / areaSqft,
        distanceMeters: distance,
        isVerified,
      });
    }

    // 3. Proximity search expansion loop
    for (const radius of searchRadii) {
      radiusUsed = radius;
      listings = resolvedCandidates.filter((c) => c.distanceMeters <= radius);
      
      // Sort by distance ascending
      listings.sort((a, b) => a.distanceMeters - b.distanceMeters);

      // Break if we have enough data points (minimum 3)
      if (listings.length >= 3) {
        break;
      }
    }

    if (listings.length < 1) {
      throw new Error("Insufficient nearby comparable listings to formulate an estimation.");
    }

    // Outlier Filtering (using 1.5 standard deviations from mean)
    const filteredListings = this.filterOutliers(listings);
    const finalDataPoints = filteredListings.length > 0 ? filteredListings : listings; // Fallback to all if empty

    // Weighted Average Calculation (Verified listings get 1.5x weight)
    let totalWeight = 0;
    let weightedSum = 0;

    finalDataPoints.forEach((item) => {
      const weight = item.isVerified ? 1.5 : 1.0;
      weightedSum += item.pricePerSqft * weight;
      totalWeight += weight;
    });

    const finalAvgPricePerSqft = weightedSum / totalWeight;
    const estimatedPrice = Math.round(finalAvgPricePerSqft * targetAreaSqft);

    // Confidence scoring logic
    let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";
    if (finalDataPoints.length >= 4 && radiusUsed <= 2000) {
      confidence = "HIGH";
    } else if (finalDataPoints.length >= 3 && radiusUsed <= 5000) {
      confidence = "MEDIUM";
    }

    return {
      estimatedPrice,
      priceRange: {
        min: Math.round(estimatedPrice * 0.9), // 10% lower
        max: Math.round(estimatedPrice * 1.1), // 10% higher
      },
      avgPricePerSqft: Math.round(finalAvgPricePerSqft * 100) / 100,
      radiusMetersUsed: radiusUsed,
      comparableCount: finalDataPoints.length,
      confidence,
    };
  }

  /**
   * Filter out statistical pricing outliers using standard deviation.
   */
  private static filterOutliers(listings: RawQueryListing[]): RawQueryListing[] {
    const prices = listings.map((l) => l.pricePerSqft);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    // If std dev is 0, no outliers exist (e.g. all prices identical)
    if (stdDev === 0) {
      return listings;
    }

    // Keep items within 1.5 standard deviations of the mean
    const threshold = 1.5 * stdDev;
    return listings.filter((item) => {
      const deviation = Math.abs(item.pricePerSqft - mean);
      return deviation <= threshold;
    });
  }
}
