import { db } from "@/lib/db";
import { ListingStatus, VerificationStatus, ReportStatus } from "@/types/db";
import { NotFoundError } from "@/lib/api-errors";

/**
 * AdminService — moderation operations using Firestore wrapper.
 */
export class AdminService {
  // ─── Private: Audit Logger ───────────────────────────────────────
  private static async logAction(
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    details?: string
  ) {
    await db.auditLog.create({
      data: { adminId, action, targetType, targetId, details },
    });
  }

  // ─── Dashboard Stats ────────────────────────────────────────────
  static async getDashboardStats() {
    const properties = await db.property.findMany();
    const users = await db.user.findMany();
    const verifications = await db.sellerVerification.findMany();
    const reports = await db.report.findMany();

    const activeListings = properties.filter((p) => p.status === "ACTIVE" && !p.deletedAt).length;
    const pendingListings = properties.filter((p) => p.status === "PENDING" && !p.deletedAt).length;
    const flaggedListings = properties.filter((p) => p.status === "FLAGGED" && !p.deletedAt).length;
    const totalListings = properties.filter((p) => !p.deletedAt).length;
    
    const totalUsers = users.filter((u) => !u.deletedAt).length;
    const pendingVerifications = verifications.filter((v) => v.status === "PENDING").length;
    const approvedVerifications = verifications.filter((v) => v.status === "APPROVED").length;
    
    const openReports = reports.filter((r) => r.status === "PENDING").length;
    const totalReports = reports.length;

    return {
      totalListings,
      activeListings,
      pendingListings,
      flaggedListings,
      totalUsers,
      pendingVerifications,
      approvedVerifications,
      openReports,
      totalReports,
    };
  }

  // ─── Listings Moderation ─────────────────────────────────────────
  static async getListingsForReview() {
    const properties = await db.property.findMany();
    const activeProperties = properties.filter((p) => !p.deletedAt);

    // Sort by createdAt DESC
    activeProperties.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return Promise.all(
      activeProperties.map(async (p) => {
        const owner = await db.user.findUnique({ where: { id: p.ownerId } });
        const images = await db.propertyImage.findMany({
          where: { propertyId: p.id },
          orderBy: { order: "asc" },
          take: 1,
        });
        const reportsCount = await db.report.count({
          where: { propertyId: p.id },
        });

        return {
          id: p.id,
          title: p.title,
          price: p.price,
          address: p.address,
          propertyType: p.propertyType,
          status: p.status,
          createdAt: p.createdAt,
          owner: owner
            ? { id: owner.id, name: owner.name, email: owner.email, role: owner.role }
            : null,
          images: images.map((img) => ({ url: img.url })),
          _count: { reports: reportsCount },
        };
      })
    );
  }

  static async updateListingStatus(
    adminId: string,
    listingId: string,
    status: ListingStatus
  ) {
    const listing = await db.property.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundError("Listing not found");

    const updated = await db.property.update({
      where: { id: listingId },
      data: { status },
    });

    await this.logAction(
      adminId,
      `LISTING_${status}`,
      "LISTING",
      listingId,
      `Status changed from ${listing.status} to ${status} for "${listing.title}"`
    );

    return updated;
  }

  static async deleteListing(adminId: string, listingId: string) {
    const listing = await db.property.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundError("Listing not found");

    await db.property.delete({ where: { id: listingId } });

    await this.logAction(
      adminId,
      "LISTING_DELETED",
      "LISTING",
      listingId,
      `Permanently deleted spam listing: "${listing.title}"`
    );
  }

  // ─── Seller Verification ────────────────────────────────────────
  static async getVerifications() {
    const verifications = await db.sellerVerification.findMany();
    
    // Sort by createdAt DESC
    verifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return Promise.all(
      verifications.map(async (v) => {
        const user = await db.user.findUnique({ where: { id: v.userId } });
        return {
          ...v,
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                company: user.company,
                createdAt: user.createdAt,
              }
            : null,
        };
      })
    );
  }

  static async updateVerification(
    adminId: string,
    userId: string,
    status: VerificationStatus
  ) {
    const verification = await db.sellerVerification.findUnique({
      where: { userId },
    });
    if (!verification) throw new NotFoundError("Verification record not found");

    const updated = await db.sellerVerification.update({
      where: { userId },
      data: {
        status,
        verifiedAt: status === "APPROVED" ? new Date().toISOString() : null,
      },
    });

    // Update user role to SELLER if approved
    if (status === "APPROVED") {
      await db.user.update({
        where: { id: userId },
        data: { role: "SELLER" },
      });
    }

    await this.logAction(
      adminId,
      `SELLER_${status}`,
      "USER",
      userId,
      `Seller verification ${status.toLowerCase()} for user ${userId}`
    );

    return updated;
  }

  // ─── Reports Management ─────────────────────────────────────────
  static async getReports() {
    const reports = await db.report.findMany();
    
    // Sort by createdAt DESC
    reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return Promise.all(
      reports.map(async (r) => {
        const reporter = await db.user.findUnique({ where: { id: r.reporterId } });
        const property = await db.property.findUnique({ where: { id: r.propertyId } });
        return {
          ...r,
          reporter: reporter
            ? { id: reporter.id, name: reporter.name, email: reporter.email }
            : null,
          property: property
            ? { id: property.id, title: property.title, status: property.status, ownerId: property.ownerId }
            : null,
        };
      })
    );
  }

  static async resolveReport(
    adminId: string,
    reportId: string,
    status: ReportStatus
  ) {
    const report = await db.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundError("Report not found");

    const updated = await db.report.update({
      where: { id: reportId },
      data: { status },
    });

    await this.logAction(
      adminId,
      `REPORT_${status}`,
      "REPORT",
      reportId,
      `Report ${status.toLowerCase()} for property ${report.propertyId}`
    );

    return updated;
  }

  // ─── Audit Log ──────────────────────────────────────────────────
  static async getAuditLog(limit = 50) {
    const logs = await db.auditLog.findMany();
    
    // Sort by createdAt DESC
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const limitedLogs = logs.slice(0, limit);

    return Promise.all(
      limitedLogs.map(async (log) => {
        const adminUser = await db.user.findUnique({ where: { id: log.adminId } });
        return {
          ...log,
          admin: adminUser
            ? { id: adminUser.id, name: adminUser.name, email: adminUser.email }
            : null,
        };
      })
    );
  }
}
