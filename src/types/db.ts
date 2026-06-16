export const Role = {
  BUYER: "BUYER",
  SELLER: "SELLER",
  AGENT: "AGENT",
  ADMIN: "ADMIN",
} as const;
export type Role = typeof Role[keyof typeof Role];

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
  IN_TALK: "IN_TALK",
  PENDING: "PENDING",
  SOLD: "SOLD",
  RENTED: "RENTED",
  FLAGGED: "FLAGGED",
} as const;
export type ListingStatus = typeof ListingStatus[keyof typeof ListingStatus];

export const ReportStatus = {
  PENDING: "PENDING",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
} as const;
export type ReportStatus = typeof ReportStatus[keyof typeof ReportStatus];

export const VerificationStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type VerificationStatus = typeof VerificationStatus[keyof typeof VerificationStatus];
