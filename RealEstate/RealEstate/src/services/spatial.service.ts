import { db } from "@/lib/db";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface NearbyPropertyResult {
  id: string;
  title: string;
  price: number;
  address: string;
  latitude: number;
  longitude: number;
  propertyType: string;
  status: string;
  ownerId: string;
  distanceMeters: number;
  imageUrl?: string | null;
}

export class SpatialService {
  /**
   * Keep compatibility helper for Well-Known Text (WKT).
   */
  static coordinatesToWkt(coordinates: [number, number][][]): string {
    if (!coordinates || coordinates.length === 0) {
      throw new Error("Invalid polygon coordinates provided");
    }
    const ringsWkt = coordinates.map((ring) => {
      const closedRing = [...ring];
      const first = closedRing[0];
      const last = closedRing[closedRing.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        closedRing.push([first[0], first[1]]);
      }
      return `(${closedRing.map((coord) => `${coord[0]} ${coord[1]}`).join(", ")})`;
    });
    return `POLYGON(${ringsWkt.join(", ")})`;
  }

  /**
   * Save or update a polygon boundary for a property listing.
   */
  static async savePolygon(propertyId: string, coordinates: [number, number][][]): Promise<void> {
    const validation = this.validatePolygonGeoJSON(coordinates);
    if (!validation.isValid) {
      throw new Error(`Invalid polygon geometry: ${validation.reason}`);
    }

    // Delete existing and create new polygon document
    await db.propertyPolygon.deleteMany({ where: { propertyId } });
    await db.propertyPolygon.create({
      data: {
        propertyId,
        coordinates,
      },
    });
  }

  /**
   * Retrieve the geodesic area of a property boundary in square meters using Shoelace formula.
   */
  static async getPolygonArea(propertyId: string): Promise<number> {
    const polygonDoc = await db.propertyPolygon.findUnique({
      where: { propertyId },
    });

    if (!polygonDoc || !polygonDoc.coordinates || polygonDoc.coordinates.length === 0) {
      return 0;
    }

    const outerRing = polygonDoc.coordinates[0];
    if (outerRing.length < 3) return 0;

    // Calculate centroid first to project coordinate degrees to flat meters
    let sumLat = 0;
    let sumLng = 0;
    const n = outerRing.length - 1; // Exclude closing point
    for (let i = 0; i < n; i++) {
      sumLng += outerRing[i][0];
      sumLat += outerRing[i][1];
    }
    const centroidLat = sumLat / n;
    const centroidLng = sumLng / n;

    // Project coordinates to meters centered on centroid
    const latRad = (centroidLat * Math.PI) / 180;
    const metersPerLat = 111139;
    const metersPerLng = 111139 * Math.cos(latRad);

    const projectedPoints = outerRing.map((coord: [number, number]) => ({
      x: (coord[0] - centroidLng) * metersPerLng,
      y: (coord[1] - centroidLat) * metersPerLat,
    }));

    // Shoelace formula
    let areaSum = 0;
    for (let i = 0; i < projectedPoints.length - 1; i++) {
      const p1 = projectedPoints[i];
      const p2 = projectedPoints[i + 1];
      areaSum += p1.x * p2.y - p2.x * p1.y;
    }

    return Math.abs(areaSum * 0.5);
  }

  /**
   * Get the centroid (lat/lng) of a property's polygon boundary.
   */
  static async getCentroid(propertyId: string): Promise<GeoPoint | null> {
    const polygonDoc = await db.propertyPolygon.findUnique({
      where: { propertyId },
    });

    if (!polygonDoc || !polygonDoc.coordinates || polygonDoc.coordinates.length === 0) {
      return null;
    }

    const outerRing = polygonDoc.coordinates[0];
    if (outerRing.length < 3) return null;

    let sumLat = 0;
    let sumLng = 0;
    const n = outerRing[0][0] === outerRing[outerRing.length - 1][0] && outerRing[0][1] === outerRing[outerRing.length - 1][1]
      ? outerRing.length - 1
      : outerRing.length;

    for (let i = 0; i < n; i++) {
      sumLng += outerRing[i][0];
      sumLat += outerRing[i][1];
    }

    return {
      latitude: sumLat / n,
      longitude: sumLng / n,
    };
  }

  /**
   * Calculate distance in meters using Haversine formula.
   */
  static async calculateDistance(from: GeoPoint, to: GeoPoint): Promise<number> {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
    const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((from.latitude * Math.PI) / 180) *
        Math.cos((to.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Perform optimized radial search by fetching properties, calculating distances, and sorting.
   */
  static async searchNearby(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<NearbyPropertyResult[]> {
    // 1. Fetch active properties
    const properties = await db.property.findMany({
      where: { status: "ACTIVE" },
    });

    const results: NearbyPropertyResult[] = [];
    const fromPoint = { latitude, longitude };

    for (const prop of properties) {
      if (prop.deletedAt) continue;

      const distance = await this.calculateDistance(fromPoint, {
        latitude: prop.latitude,
        longitude: prop.longitude,
      });

      if (distance <= radiusMeters) {
        // Fetch first image
        const images = await db.propertyImage.findMany({
          where: { propertyId: prop.id },
          orderBy: { order: "asc" },
          take: 1,
        });

        results.push({
          id: prop.id,
          title: prop.title,
          price: prop.price,
          address: prop.address,
          latitude: prop.latitude,
          longitude: prop.longitude,
          propertyType: prop.propertyType,
          status: prop.status,
          ownerId: prop.ownerId,
          distanceMeters: distance,
          imageUrl: images[0]?.url || "",
        });
      }
    }

    // Sort by distance ascending
    results.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return results;
  }

  /**
   * Validate geometry structure on application side before executing db operations.
   */
  static validatePolygonGeoJSON(coordinates: [number, number][][]): { isValid: boolean; reason?: string } {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return { isValid: false, reason: "Coordinates must be a non-empty array of rings" };
    }

    for (let r = 0; r < coordinates.length; r++) {
      const ring = coordinates[r];
      if (!Array.isArray(ring)) {
        return { isValid: false, reason: `Ring at index ${r} is not a valid coordinate array` };
      }
      if (ring.length < 3) {
        return { isValid: false, reason: `Ring at index ${r} must contain at least 3 unique coordinates` };
      }

      for (let c = 0; c < ring.length; c++) {
        const coord = ring[c];
        if (!Array.isArray(coord) || coord.length !== 2) {
          return { isValid: false, reason: `Coordinate at ring ${r}, index ${c} must be a [longitude, latitude] array` };
        }
        
        const [lng, lat] = coord;
        if (typeof lng !== "number" || typeof lat !== "number" || isNaN(lng) || isNaN(lat)) {
          return { isValid: false, reason: `Coordinate at ring ${r}, index ${c} contains invalid number types` };
        }
        if (lat < -90 || lat > 90) {
          return { isValid: false, reason: `Latitude ${lat} at ring ${r}, index ${c} is out of bounds (-90 to 90)` };
        }
        if (lng < -180 || lng > 180) {
          return { isValid: false, reason: `Longitude ${lng} at ring ${r}, index ${c} is out of bounds (-180 to 180)` };
        }
      }
    }

    return { isValid: true };
  }
}
