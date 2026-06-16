import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { ValidationError } from "@/lib/api-errors";
import { PriceEstimationService } from "@/services/price-estimation.service";
import { PropertyType } from "@/types/db";

/**
 * GET /api/estimate-price
 * Estimates the valuation of a target location using spatial PostGIS queries.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);

  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const propertyTypeStr = searchParams.get("propertyType");
  const areaSqftStr = searchParams.get("areaSqft");

  if (!latStr || !lngStr || !propertyTypeStr || !areaSqftStr) {
    throw new ValidationError("Missing required parameters: lat, lng, propertyType, areaSqft");
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  const areaSqft = parseFloat(areaSqftStr);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    throw new ValidationError("Invalid latitude. Must be a number between -90 and 90.");
  }

  if (isNaN(lng) || lng < -180 || lng > 180) {
    throw new ValidationError("Invalid longitude. Must be a number between -180 and 180.");
  }

  if (isNaN(areaSqft) || areaSqft <= 0) {
    throw new ValidationError("Invalid areaSqft. Must be a positive number.");
  }

  // Validate propertyType is part of the PropertyType enum
  const validTypes = Object.values(PropertyType);
  if (!validTypes.includes(propertyTypeStr as PropertyType)) {
    throw new ValidationError(`Invalid propertyType. Must be one of: ${validTypes.join(", ")}`);
  }

  const result = await PriceEstimationService.estimatePrice(
    lat,
    lng,
    propertyTypeStr as PropertyType,
    areaSqft
  );

  return ApiResponse.success(result, "Valuation estimate generated successfully");
});
