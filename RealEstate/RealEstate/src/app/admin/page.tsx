"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Shield,
  LayoutDashboard,
  Building,
  Users,
  AlertTriangle,
  ClipboardList,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  Clock,
  TrendingUp,
  Flag,
  ArrowLeft,
  RefreshCw,
  Loader2,
  LogOut,
  MessageSquare,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface DashboardStats {
  totalListings: number;
  activeListings: number;
  pendingListings: number;
  flaggedListings: number;
  totalUsers: number;
  pendingVerifications: number;
  approvedVerifications: number;
  openReports: number;
  totalReports: number;
}

interface AdminListing {
  id: string;
  title: string;
  price: number;
  address: string;
  propertyType: string;
  status: string;
  createdAt: string;
  owner: { id: string; name: string | null; email: string | null; role: string };
  images: { url: string }[];
  _count: { reports: number };
}

interface SellerVerification {
  id: string;
  userId: string;
  status: string;
  documentUrls: string[];
  verifiedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    phone: string | null;
    company: string | null;
    createdAt: string;
  };
}

interface Report {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter: { id: string; name: string | null; email: string | null };
  property: { id: string; title: string; status: string; ownerId: string };
}

interface AuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
  createdAt: string;
  admin: { id: string; name: string | null; email: string | null };
}

type Tab = "listings" | "sellers" | "reports" | "users" | "messages" | "audit";

// ─── Relative Time Formatter (pure, takes snapshot) ─────────────

function formatRelativeTime(dateStr: string, now: number) {
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Status Badge Component ──────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    FLAGGED: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20",
    DRAFT: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20",
    SOLD: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20",
    RENTED: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/20",
    APPROVED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    REJECTED: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20",
    RESOLVED: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20",
    DISMISSED: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {status}
    </span>
  );
}

// ─── Stat Card Component ─────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{value}</p>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

// ─── Main Admin Dashboard ────────────────────────────────────────

export default function AdminDashboard() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("listings");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [sellers, setSellers] = useState<SellerVerification[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser1, setSelectedUser1] = useState<string>("");
  const [selectedUser2, setSelectedUser2] = useState<string>("");
  const [selectedChatHistory, setSelectedChatHistory] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [renderNow, setRenderNow] = useState(() => 0);
  const hasFetched = useRef(false);

  // ─── Data Fetchers (standalone, no setState dependency) ─────
  const loadAllData = useCallback(async () => {
    const [statsRes, listingsRes, sellersRes, reportsRes, auditRes, usersRes] = await Promise.all([
      fetch("/api/admin/stats").then(r => r.json()),
      fetch("/api/admin/listings").then(r => r.json()),
      fetch("/api/admin/sellers").then(r => r.json()),
      fetch("/api/admin/reports").then(r => r.json()),
      fetch("/api/admin/audit-log").then(r => r.json()),
      fetch("/api/admin/users").then(r => r.json()),
    ]);
    return { statsRes, listingsRes, sellersRes, reportsRes, auditRes, usersRes };
  }, []);

  const applyData = useCallback((results: Awaited<ReturnType<typeof loadAllData>>) => {
    if (results.statsRes.success) setStats(results.statsRes.data);
    if (results.listingsRes.success) setListings(results.listingsRes.data);
    if (results.sellersRes.success) setSellers(results.sellersRes.data);
    if (results.reportsRes.success) setReports(results.reportsRes.data);
    if (results.auditRes.success) setAuditLog(results.auditRes.data);
    if (results.usersRes?.success) setUsers(results.usersRes.data);
    setRenderNow(Date.now());
    setLoading(false);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    const results = await loadAllData();
    applyData(results);
  }, [loadAllData, applyData]);

  const fetchChatHistory = useCallback(async (u1: string, u2: string) => {
    if (!u1 || !u2) return;
    setChatLoading(true);
    try {
      const res = await fetch(`/api/admin/messages?user1=${u1}&user2=${u2}`);
      const data = await res.json();
      if (data.success) {
        setSelectedChatHistory(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUser1 && selectedUser2) {
      fetchChatHistory(selectedUser1, selectedUser2);
    } else {
      setSelectedChatHistory([]);
    }
  }, [selectedUser1, selectedUser2, fetchChatHistory]);

  // Initial load: trigger once when session becomes authenticated + ADMIN
  useEffect(() => {
    if (sessionStatus === "authenticated" && session?.user?.role === "ADMIN") {
      if (!hasFetched.current) {
        hasFetched.current = true;
        let cancelled = false;
        loadAllData().then((results) => {
          if (!cancelled) applyData(results);
        });
        return () => { cancelled = true; };
      }
    }
  }, [sessionStatus, session, loadAllData, applyData]);

  const handleUpdateUserStatus = async (userId: string, newStatus: string) => {
    const actionLabel = newStatus === "BANNED" ? "ban" : newStatus === "FLAGGED" ? "flag" : "restore";
    if (!window.confirm(`Are you sure you want to ${actionLabel} this user?`)) {
      return;
    }
    
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: newStatus }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to update user status");
      
      alert(`User status updated successfully!`);
      // Reload page data
      const results = await loadAllData();
      if (results.usersRes?.success) setUsers(results.usersRes.data);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An error occurred");
    }
  };

  // ─── Action Handlers ────────────────────────────────────────
  const handleListingAction = async (id: string, action: "ACTIVE" | "PENDING" | "FLAGGED" | "DELETE") => {
    setActionLoading(id);
    try {
      if (action === "DELETE") {
        await fetch(`/api/admin/listings/${id}`, { method: "DELETE" });
      } else {
        await fetch(`/api/admin/listings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action }),
        });
      }
      await refreshAll();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSellerAction = async (userId: string, status: "APPROVED" | "REJECTED") => {
    setActionLoading(userId);
    try {
      await fetch(`/api/admin/sellers/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await refreshAll();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReportAction = async (reportId: string, status: "RESOLVED" | "DISMISSED") => {
    setActionLoading(reportId);
    try {
      await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await refreshAll();
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Auth Guard ──────────────────────────────────────────────
  if (sessionStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!session || session.user?.role !== "ADMIN") {
    router.push("/");
    return null;
  }

  // ─── Tab Definitions ────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "listings", label: "Listings", icon: Building, count: listings.length },
    { id: "sellers", label: "Sellers", icon: Users, count: stats?.pendingVerifications },
    { id: "reports", label: "Reports", icon: AlertTriangle, count: stats?.openReports },
    { id: "users", label: "Active Users", icon: Users },
    { id: "messages", label: "Chat Logs", icon: MessageSquare },
    { id: "audit", label: "Audit Log", icon: ClipboardList, count: auditLog.length },
  ];

  // ─── Relative Time (uses snapshot) ──────────────────────────
  const relativeTime = (dateStr: string) => formatRelativeTime(dateStr, renderNow);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ─── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-5 w-5 text-slate-500" />
            </button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-extrabold text-lg text-slate-900 dark:text-white leading-tight">Admin Panel</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Content Moderation</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshAll}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 hover:bg-rose-500 hover:text-white border border-rose-500/25 transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ─── Stats Cards ────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <StatCard label="Total Listings" value={stats.totalListings} icon={Building} color="bg-indigo-500/10 text-indigo-600" />
            <StatCard label="Active" value={stats.activeListings} icon={TrendingUp} color="bg-emerald-500/10 text-emerald-600" />
            <StatCard label="Pending Review" value={stats.pendingListings} icon={Clock} color="bg-amber-500/10 text-amber-600" />
            <StatCard label="Flagged" value={stats.flaggedListings} icon={Flag} color="bg-rose-500/10 text-rose-600" />
            <StatCard label="Open Reports" value={stats.openReports} icon={AlertTriangle} color="bg-orange-500/10 text-orange-600" />
          </div>
        )}

        {/* ─── Tab Bar ─────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── Tab Content ─────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* ═══ Listings Tab ═══ */}
            {activeTab === "listings" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 text-indigo-500" />
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white">Listing Moderation</h2>
                  <span className="text-[10px] font-bold text-slate-400 ml-auto">{listings.length} listings</span>
                </div>
                {listings.length === 0 ? (
                  <div className="px-6 py-16 text-center text-sm text-slate-400">No listings to review</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {listings.map((listing) => (
                      <div key={listing.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        {/* Thumbnail */}
                        <div className="h-14 w-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                          {listing.images[0] ? (
                            <Image src={listing.images[0].url} alt={listing.title} width={56} height={56} className="h-full w-full object-cover" unoptimized />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Building className="h-5 w-5 text-slate-300" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{listing.title}</p>
                            <StatusBadge status={listing.status} />
                            {listing._count.reports > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                <AlertTriangle className="h-3 w-3" />
                                {listing._count.reports}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {formatPrice(listing.price)} · {listing.propertyType} · by {listing.owner.name || listing.owner.email} · {relativeTime(listing.createdAt)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => window.open(`/listings/${listing.id}`, "_blank")}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            title="View Listing"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {listing.status !== "ACTIVE" && (
                            <button
                              onClick={() => handleListingAction(listing.id, "ACTIVE")}
                              disabled={actionLoading === listing.id}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                              title="Approve"
                            >
                              <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
                              Approve
                            </button>
                          )}
                          {listing.status !== "FLAGGED" && (
                            <button
                              onClick={() => handleListingAction(listing.id, "FLAGGED")}
                              disabled={actionLoading === listing.id}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                              title="Flag"
                            >
                              <Flag className="h-3.5 w-3.5 inline mr-1" />
                              Flag
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm(`Permanently delete "${listing.title}"? This cannot be undone.`)) {
                                handleListingAction(listing.id, "DELETE");
                              }
                            }}
                            disabled={actionLoading === listing.id}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                            title="Delete Spam"
                          >
                            <Trash2 className="h-3.5 w-3.5 inline mr-1" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══ Sellers Tab ═══ */}
            {activeTab === "sellers" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500" />
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white">Seller Verification</h2>
                  <span className="text-[10px] font-bold text-slate-400 ml-auto">{sellers.length} records</span>
                </div>
                {sellers.length === 0 ? (
                  <div className="px-6 py-16 text-center text-sm text-slate-400">No verification records found</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sellers.map((v) => (
                      <div key={v.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        {/* Avatar */}
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {(v.user.name || "?").charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-sm text-slate-900 dark:text-white">{v.user.name || "Unnamed"}</p>
                            <StatusBadge status={v.status} />
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {v.user.email} · {v.user.role} · {v.user.company || "No company"} · {v.user.phone || "No phone"}
                          </p>
                          {v.documentUrls.length > 0 && (
                            <p className="text-[10px] text-indigo-500 mt-0.5">{v.documentUrls.length} document(s) uploaded</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {v.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleSellerAction(v.userId, "APPROVED")}
                                disabled={actionLoading === v.userId}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
                                Approve
                              </button>
                              <button
                                onClick={() => handleSellerAction(v.userId, "REJECTED")}
                                disabled={actionLoading === v.userId}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <XCircle className="h-3.5 w-3.5 inline mr-1" />
                                Reject
                              </button>
                            </>
                          )}
                          {v.status === "APPROVED" && (
                            <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Verified {v.verifiedAt ? relativeTime(v.verifiedAt) : ""}
                            </span>
                          )}
                          {v.status === "REJECTED" && (
                            <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                              <XCircle className="h-3.5 w-3.5" />
                              Rejected
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══ Reports Tab ═══ */}
            {activeTab === "reports" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white">Reported Content</h2>
                  <span className="text-[10px] font-bold text-slate-400 ml-auto">{reports.length} reports</span>
                </div>
                {reports.length === 0 ? (
                  <div className="px-6 py-16 text-center text-sm text-slate-400">No reports to review</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {reports.map((r) => (
                      <div key={r.id} className="px-6 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className={`p-2.5 rounded-xl shrink-0 ${r.status === "PENDING" ? "bg-orange-500/10 text-orange-600" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                            <AlertTriangle className="h-4 w-4" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{r.property.title}</p>
                              <StatusBadge status={r.status} />
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1.5 leading-relaxed">&ldquo;{r.reason}&rdquo;</p>
                            <p className="text-[10px] text-slate-400">
                              Reported by {r.reporter.name || r.reporter.email} · {relativeTime(r.createdAt)}
                            </p>
                          </div>

                          {/* Actions */}
                          {r.status === "PENDING" && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleReportAction(r.id, "RESOLVED")}
                                disabled={actionLoading === r.id}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
                                Resolve
                              </button>
                              <button
                                onClick={() => handleReportAction(r.id, "DISMISSED")}
                                disabled={actionLoading === r.id}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 border border-slate-500/20 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <XCircle className="h-3.5 w-3.5 inline mr-1" />
                                Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══ Active Users Tab ═══ */}
            {activeTab === "users" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-500" />
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white">Active Users Presence</h2>
                  <span className="text-[10px] font-bold text-slate-400 ml-auto">{users.length} users registered</span>
                </div>
                {users.length === 0 ? (
                  <div className="px-6 py-16 text-center text-sm text-slate-400">No users found</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map((u) => {
                      const active = u.lastActiveAt ? (Date.now() - new Date(u.lastActiveAt).getTime()) < 300000 : false;
                      return (
                        <div key={u.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="h-10 w-10 rounded-full overflow-hidden bg-indigo-50 border border-slate-200 dark:border-slate-850 flex items-center justify-center shrink-0">
                                {u.image ? (
                                  <img src={u.image} alt={u.name || "User"} className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-indigo-500 uppercase">{u.name?.substring(0, 2) || "US"}</span>
                                )}
                              </div>
                              <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${active ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="font-bold text-sm text-slate-900 dark:text-white">{u.name || "Unknown User"}</p>
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${u.role === "ADMIN" ? "bg-indigo-500/10 text-indigo-500" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>{u.role}</span>
                                {u.status === "BANNED" && (
                                  <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-500 border border-rose-500/30 animate-pulse">Banned</span>
                                )}
                                {u.status === "FLAGGED" && (
                                  <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse">Flagged</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-450">{u.email} · {u.phone || "No phone"}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right shrink-0">
                              {active ? (
                                <span className="text-xs font-bold text-emerald-500">Online Now</span>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  Last seen {u.lastActiveAt ? relativeTime(u.lastActiveAt) : "never"}
                                </span>
                              )}
                              <p className="text-[10px] text-slate-350">Joined {relativeTime(u.createdAt)}</p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedUser1(u.id);
                                setSelectedUser2("");
                                setActiveTab("messages");
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer"
                              title="Audit user conversations"
                            >
                              Conversations
                            </button>

                            {u.role !== "ADMIN" && (
                              <div className="flex items-center gap-1.5">
                                {u.status === "BANNED" ? (
                                  <button
                                    onClick={() => handleUpdateUserStatus(u.id, "ACTIVE")}
                                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
                                  >
                                    Unban
                                  </button>
                                ) : (
                                  <>
                                    {u.status === "FLAGGED" ? (
                                      <button
                                        onClick={() => handleUpdateUserStatus(u.id, "ACTIVE")}
                                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-slate-600 hover:bg-slate-500 text-white shadow-sm transition-all cursor-pointer"
                                      >
                                        Unflag
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleUpdateUserStatus(u.id, "FLAGGED")}
                                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-amber-650 hover:bg-amber-500 text-white shadow-sm transition-all cursor-pointer"
                                      >
                                        Flag
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleUpdateUserStatus(u.id, "BANNED")}
                                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all cursor-pointer"
                                    >
                                      Ban
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══ Chat Logs Tab ═══ */}
            {activeTab === "messages" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* selectors */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-4 self-start">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Audit Participant Chat</h3>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Participant A</label>
                    <select
                      value={selectedUser1}
                      onChange={(e) => setSelectedUser1(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Select Participant A --</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name || u.email} ({u.role})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Participant B</label>
                    <select
                      value={selectedUser2}
                      onChange={(e) => setSelectedUser2(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- Select Participant B --</option>
                      {users
                        .filter(u => u.id !== selectedUser1)
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.name || u.email} ({u.role})</option>
                        ))}
                    </select>
                  </div>

                  {selectedUser1 && (
                    <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200/50 dark:border-slate-800/50 text-[11px] text-slate-500 leading-relaxed">
                      💡 Tip: Click on a user's <span className="font-bold">Conversations</span> button in the Active Users list to auto-select Participant A.
                    </div>
                  )}
                </div>

                {/* chat window */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col min-h-[450px]">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-indigo-500" />
                    <h2 className="font-bold text-sm text-slate-900 dark:text-white">Conversation Audit Log</h2>
                  </div>

                  {!selectedUser1 || !selectedUser2 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <MessageSquare className="h-8 w-8 text-slate-350 mb-3" />
                      <p className="text-sm font-semibold text-slate-400">Select two participants from the panel to audit their conversation history.</p>
                    </div>
                  ) : chatLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                    </div>
                  ) : selectedChatHistory.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <p className="text-sm font-semibold text-slate-400">No messages exchanged between these two users.</p>
                    </div>
                  ) : (
                    <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 max-h-[450px] bg-slate-50/50 dark:bg-slate-950/20">
                      {selectedChatHistory.map((m) => {
                        const isUser1 = m.senderId === selectedUser1;
                        const senderName = isUser1 
                          ? (users.find(u => u.id === selectedUser1)?.name || "Participant A")
                          : (users.find(u => u.id === selectedUser2)?.name || "Participant B");
                        return (
                          <div key={m.id} className={`flex flex-col max-w-[75%] ${isUser1 ? "self-start items-start" : "self-end items-end"}`}>
                            <span className="text-[10px] font-bold text-slate-400 mb-1 px-1">{senderName}</span>
                            <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm ${
                              isUser1 
                                ? "bg-white dark:bg-slate-800 text-slate-850 dark:text-slate-100 border border-slate-150 dark:border-slate-700/50 rounded-tl-none" 
                                : "bg-indigo-650 text-white rounded-tr-none"
                            }`}>
                              {m.content}
                            </div>
                            <span className="text-[9px] text-slate-350 mt-1 px-1">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {m.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ Audit Log Tab ═══ */}
            {activeTab === "audit" && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-indigo-500" />
                  <h2 className="font-bold text-sm text-slate-900 dark:text-white">Audit Log</h2>
                  <span className="text-[10px] font-bold text-slate-400 ml-auto">{auditLog.length} entries</span>
                </div>
                {auditLog.length === 0 ? (
                  <div className="px-6 py-16 text-center text-sm text-slate-400">No admin actions recorded yet</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditLog.map((entry) => {
                      const actionColors: Record<string, string> = {
                        LISTING_ACTIVE: "text-emerald-600 bg-emerald-500/10",
                        LISTING_FLAGGED: "text-amber-600 bg-amber-500/10",
                        LISTING_PENDING: "text-amber-600 bg-amber-500/10",
                        LISTING_DELETED: "text-rose-600 bg-rose-500/10",
                        SELLER_APPROVED: "text-emerald-600 bg-emerald-500/10",
                        SELLER_REJECTED: "text-rose-600 bg-rose-500/10",
                        REPORT_RESOLVED: "text-sky-600 bg-sky-500/10",
                        REPORT_DISMISSED: "text-slate-600 bg-slate-500/10",
                      };
                      const colorClass = actionColors[entry.action] || "text-slate-600 bg-slate-500/10";

                      return (
                        <div key={entry.id} className="px-6 py-3.5 flex items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${colorClass}`}>
                            {entry.action.replace(/_/g, " ")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{entry.details || `${entry.targetType} ${entry.targetId}`}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] font-bold text-slate-400">{entry.admin.name || entry.admin.email}</p>
                            <p className="text-[10px] text-slate-300">{relativeTime(entry.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
