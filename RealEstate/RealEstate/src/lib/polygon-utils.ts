/**
 * Validates and transforms coordinate arrays for polygon boundaries.
 */

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Calculates the geographic area of a polygon in square meters using the spherical Shoelace formula.
 */
export function calculatePolygonArea(coordinates: [number, number][]): number {
  if (coordinates.length < 3) return 0;
  
  // Earth radius in meters
  const R = 6378137;
  let area = 0;
  const len = coordinates.length;
  
  for (let i = 0; i < len; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[(i + 1) % len];
    
    // Convert degrees to radians
    const lat1 = (p1[0] * Math.PI) / 180;
    const lat2 = (p2[0] * Math.PI) / 180;
    const lng1 = (p1[1] * Math.PI) / 180;
    const lng2 = (p2[1] * Math.PI) / 180;
    
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  
  area = Math.abs((area * R * R) / 2);
  return area; // in square meters
}

/**
 * Calculates the planar perimeter of a polygon in meters (approximate).
 */
export function calculatePolygonPerimeter(coordinates: [number, number][]): number {
  if (coordinates.length < 2) return 0;
  
  let perimeter = 0;
  const len = coordinates.length;
  
  for (let i = 0; i < len; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[(i + 1) % len];
    
    perimeter += getHaversineDistance(p1[0], p1[1], p2[0], p2[1]);
  }
  
  return perimeter;
}

/**
 * Haversine formula to find distance between two points in meters.
 */
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Orientation of three points: collinear (0), clockwise (1), or counterclockwise (2).
 */
function orientation(p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-12) return 0; // collinear
  return val > 0 ? 1 : 2; // clock or counterclock
}

/**
 * Checks if point q lies on line segment pr.
 */
function onSegment(p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }): boolean {
  return (
    q.x <= Math.max(p.x, r.x) &&
    q.x >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) &&
    q.y >= Math.min(p.y, r.y)
  );
}

/**
 * Checks if line segments p1q1 and p2q2 intersect.
 */
function doSegmentsIntersect(
  p1: { x: number; y: number },
  q1: { x: number; y: number },
  p2: { x: number; y: number },
  q2: { x: number; y: number }
): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  // General case
  if (o1 !== o2 && o3 !== o4) return true;

  // Special cases (collinear segments crossing)
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

/**
 * Returns true if a polygon's boundary edges intersect with each other (self-intersection).
 */
export function isPolygonSelfIntersecting(coordinates: [number, number][]): boolean {
  const n = coordinates.length;
  if (n < 4) return false; // Triangles cannot self-intersect

  // Map coordinates to {x: lng, y: lat} objects for simpler calculation
  const points = coordinates.map((coord) => ({ x: coord[1], y: coord[0] }));

  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const q1 = points[(i + 1) % n];

    for (let j = i + 2; j < n; j++) {
      // Avoid checking adjacent segments (which naturally intersect at their shared vertex)
      if ((j + 1) % n === i) continue;

      const p2 = points[j];
      const q2 = points[(j + 1) % n];

      if (doSegmentsIntersect(p1, q1, p2, q2)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validates a polygon boundary configuration.
 */
export function validatePolygon(coordinates: [number, number][]): ValidationResult {
  const errors: string[] = [];

  if (coordinates.length < 3) {
    errors.push("A polygon must have at least 3 vertices.");
  }

  if (coordinates.length >= 3) {
    if (isPolygonSelfIntersecting(coordinates)) {
      errors.push("Invalid polygon: boundaries cannot cross or self-intersect.");
    }

    const area = calculatePolygonArea(coordinates);
    if (area <= 0) {
      errors.push("Invalid polygon: coordinates are collinear and enclose zero area.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Converts a list of coordinates [lat, lng] to Well-Known Text (WKT) POLYGON.
 * Appends the first coordinate at the end to close the loop.
 */
export function coordinatesToWkt(coordinates: [number, number][]): string {
  if (coordinates.length === 0) return "";
  
  const closedCoords = [...coordinates];
  
  // Ensure the loop is closed for WKT standard
  const first = closedCoords[0];
  const last = closedCoords[closedCoords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    closedCoords.push(first);
  }
  
  const wktPoints = closedCoords.map((coord) => `${coord[1]} ${coord[0]}`).join(", ");
  return `POLYGON((${wktPoints}))`;
}

/**
 * Parses WKT representation e.g. "POLYGON((lng1 lat1, lng2 lat2, ...))" to coordinate array [lat, lng].
 * Removes the repeated closing point at the end.
 */
export function wktToCoordinates(wkt: string): [number, number][] {
  if (!wkt || typeof wkt !== "string") return [];
  
  const match = wkt.trim().match(/^POLYGON\s*\(\s*\(\s*(.*)\s*\)\s*\)$/i);
  if (!match) return [];
  
  const pointsStr = match[1];
  const pairs = pointsStr.split(",");
  const coords: [number, number][] = [];
  
  for (const pair of pairs) {
    const tokens = pair.trim().split(/\s+/);
    if (tokens.length >= 2) {
      const lng = parseFloat(tokens[0]);
      const lat = parseFloat(tokens[1]);
      if (!isNaN(lng) && !isNaN(lat)) {
        coords.push([lat, lng]);
      }
    }
  }
  
  // Remove the closed point if it matches the first point
  if (coords.length > 1) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      coords.pop();
    }
  }
  
  return coords;
}

/**
 * Exports coordinates to a GeoJSON Feature string.
 */
export function coordinatesToGeoJson(coordinates: [number, number][], properties: Record<string, unknown> = {}): string {
  if (coordinates.length === 0) return "";
  
  const closedCoords = [...coordinates];
  const first = closedCoords[0];
  const last = closedCoords[closedCoords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    closedCoords.push(first);
  }
  
  // GeoJSON coordinates are [longitude, latitude]
  const geoJsonCoords = closedCoords.map((coord) => [coord[1], coord[0]]);
  
  const feature = {
    type: "Feature",
    properties,
    geometry: {
      type: "Polygon",
      coordinates: [geoJsonCoords],
    },
  };
  
  return JSON.stringify(feature, null, 2);
}

/**
 * Parses a GeoJSON string back into a list of coordinates [lat, lng].
 */
export function geoJsonToCoordinates(geoJsonStr: string): [number, number][] {
  try {
    const data = JSON.parse(geoJsonStr);
    let geom = data;
    
    if (data.type === "FeatureCollection") {
      geom = data.features[0]?.geometry;
    } else if (data.type === "Feature") {
      geom = data.geometry;
    }
    
    if (!geom || geom.type !== "Polygon") {
      throw new Error("Only Polygon geometries are supported");
    }
    
    // GeoJSON is [[[lng, lat], [lng, lat], ...]]
    const ring = geom.coordinates[0];
    if (!Array.isArray(ring)) return [];
    
    const coords = ring.map((pt: number[]) => [pt[1], pt[0]] as [number, number]);
    
    // Remove final closing coordinate if it matches the start
    if (coords.length > 1) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] === last[0] && first[1] === last[1]) {
        coords.pop();
      }
    }
    
    return coords;
  } catch (err) {
    console.error("Failed to parse GeoJSON:", err);
    throw new Error(err instanceof Error ? err.message : "Invalid GeoJSON Polygon format");
  }
}
