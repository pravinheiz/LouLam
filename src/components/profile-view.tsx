"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Mail,
  Calendar,
  Building,
  Edit2,
  Save,
  X,
  ArrowLeft,
  Loader2,
  MapPin,
  ShieldCheck,
  AlertCircle,
  Info,
  Eye,
  ChevronLeft,
  ChevronRight,
  Camera,
  Upload,
  FileText,
  Phone,
  BookOpen,
  MessageSquare
} from "lucide-react";
import { getOptimizedImageUrl } from "@/lib/image-utils";
import { uploadToFirebaseStorage } from "@/lib/firebase-upload";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: string;
  image?: string | null;
  phone?: string | null;
  phoneVerified?: boolean | null;
  dateOfBirth?: string | null;
  bio?: string | null;
  company?: string | null;
  address?: string | null;
  sellerVerification?: {
    status: string;
    documentUrls: string[];
    verifiedAt: string;
  } | null;
}

interface ListingItem {
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
  images: string[];
}

interface ProfileViewProps {
  profileId: string; // "me" or a specific user UUID
}

export function ProfileView({ profileId }: ProfileViewProps) {
  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDateOfBirth, setEditDateOfBirth] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Details modal state
  const [selectedListing, setSelectedListing] = useState<ListingItem | null>(null);
  const [detailImageIndex, setDetailImageIndex] = useState(0);

  // Avatar & Verification State
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [verifyingDoc, setVerifyingDoc] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [legalNameInput, setLegalNameInput] = useState("");
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Fetch profile details
  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/profile/${profileId}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || "Failed to retrieve profile data");
        }

        const { user, listings: userListings, isOwnProfile: own } = data.data;
        setProfileUser(user);
        setListings(userListings);
        setIsOwnProfile(own);

        setEditName(user.name || "");
        setEditEmail(user.email || "");
        setEditPhone(user.phone || "");
        setEditDateOfBirth(user.dateOfBirth || "");
        setEditBio(user.bio || "");
        setEditCompany(user.company || "");
        setEditAddress(user.address || "");
        setLegalNameInput(user.name || "");
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : "An error occurred while loading the profile.");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [profileId]);

  // Firebase Storage direct uploader helper
  const uploadToFirebase = async (file: File, folder: string = "profile-assets"): Promise<string> => {
    return uploadToFirebaseStorage(file, folder);
  };

  // Handle avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    try {
      setUploadingAvatar(true);
      const uploadedUrl = await uploadToFirebase(file, "profile-avatars");
      
      const response = await fetch(`/api/profile/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileUser?.name || "",
          email: profileUser?.email || "",
          image: uploadedUrl,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update profile picture");
      }

      setProfileUser((prev) => 
        prev ? { ...prev, image: uploadedUrl } : null
      );
      alert("Profile picture updated successfully!");
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to upload avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle identity verification form submission
  const handleVerifyIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || !legalNameInput) {
      setVerificationError("Please provide both legal name and document file.");
      return;
    }

    try {
      setVerifyingDoc(true);
      setVerificationError(null);

      // 1. Upload document to Firebase Storage
      const uploadedDocUrl = await uploadToFirebase(docFile, "profile-verification-documents");

      // 2. Start high-tech Scanning Simulation
      setIsScanning(true);
      setScanStep(0);

      // Step 0 -> Step 1 (800ms)
      await new Promise(resolve => setTimeout(resolve, 800));
      setScanStep(1);

      // Step 1 -> Step 2 (800ms)
      await new Promise(resolve => setTimeout(resolve, 800));
      setScanStep(2);

      // Step 2 -> Step 3 (800ms)
      await new Promise(resolve => setTimeout(resolve, 800));
      setScanStep(3);

      // Step 3 -> Finish (800ms)
      await new Promise(resolve => setTimeout(resolve, 800));

      // 3. Post to API to save verification and update name
      const response = await fetch(`/api/profile/${profileId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: legalNameInput,
          documentUrl: uploadedDocUrl,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to submit verification");
      }

      setProfileUser((prev) => 
        prev ? { 
          ...prev, 
          name: data.data.name,
          sellerVerification: data.data.sellerVerification
        } : null
      );
      
      setEditName(data.data.name);
      setIsScanning(false);
      alert("Identity successfully verified! Legal name has been locked.");
    } catch (err: unknown) {
      console.error(err);
      setVerificationError(err instanceof Error ? err.message : "Failed to verify identity.");
      setIsScanning(false);
    } finally {
      setVerifyingDoc(false);
    }
  };

  // Handle edit form submit
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveError(null);

      const response = await fetch(`/api/profile/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          image: profileUser?.image,
          phone: editPhone,
          dateOfBirth: editDateOfBirth,
          bio: editBio,
          company: editCompany,
          address: editAddress,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update profile details");
      }

      setProfileUser((prev) => 
        prev ? { 
          ...prev, 
          name: data.data.name, 
          email: data.data.email,
          phone: data.data.phone,
          dateOfBirth: data.data.dateOfBirth,
          bio: data.data.bio,
          company: data.data.company,
          address: data.data.address
        } : null
      );
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (err: unknown) {
      console.error(err);
      setSaveError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  // Format currency
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Legitimacy scoring calculations
  const activeListings = listings.filter((l) => l.status === "ACTIVE");
  const listingCount = activeListings.length;
  const isLegitimate = listingCount >= 2; // Having at least 2 active properties implies legitimacy
  const isVerified = profileUser?.sellerVerification?.status === "APPROVED";

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[50vh] gap-3 text-slate-400">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Retrieving Profile Details...
        </span>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <div className="flex-1 max-w-2xl mx-auto my-12 p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center shadow-xl">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-lg font-black uppercase tracking-wider text-white mb-2">
          Profile Load Failed
        </h2>
        <p className="text-sm text-slate-400 mb-6">{error || "User could not be found."}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition-all shadow-md"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Marketplace</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Marketplace</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: User profile info */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          {/* Profile Card */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            {/* Visual background glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col items-center text-center relative z-10">
              {/* User Avatar Circle */}
              <div className="relative group mb-4">
                <div className="h-24 w-24 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-indigo-500/10 border-2 border-slate-800">
                  {uploadingAvatar ? (
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  ) : profileUser.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={profileUser.image}
                      alt={profileUser.name || "User Avatar"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    profileUser.name ? profileUser.name[0].toUpperCase() : "U"
                  )}
                </div>
                {isOwnProfile && !uploadingAvatar && (
                  <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity text-white text-[10px] font-bold">
                    <Camera className="h-5 w-5 mb-0.5" />
                    <span>Change</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {!isEditing ? (
                <>
                  <h2 className="text-xl font-black text-white leading-tight">
                    {profileUser.name || "Anonymous User"}
                  </h2>
                  <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-500 mt-1 block">
                    {profileUser.role} Account
                  </span>

                  <div className="w-full h-px bg-slate-800/80 my-5" />

                  {/* Profile Metadata */}
                  <div className="w-full flex flex-col gap-3.5 text-left text-xs font-medium text-slate-400">
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span className="truncate">{profileUser.email || "No email listed"}</span>
                    </div>

                    {profileUser.phone && (
                      <div className="space-y-1.5 w-full">
                        <div className="flex items-center gap-2.5">
                          <Phone className="h-4 w-4 text-indigo-500 shrink-0" />
                          <span>{profileUser.phone}</span>
                          {profileUser.phoneVerified && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.25 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold rounded">
                              ✓ Verified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 pl-[26px]">
                          <a
                            href={`tel:${profileUser.phone}`}
                            className="inline-flex items-center gap-1.5 py-0.5 px-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold transition-all"
                          >
                            <Phone className="h-3 w-3" />
                            <span>Call</span>
                          </a>
                          <a
                            href={`https://wa.me/${profileUser.phone.replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 py-0.5 px-2 bg-emerald-550/10 hover:bg-emerald-550/20 text-emerald-400 rounded-lg text-[10px] font-bold transition-all"
                          >
                            <MessageSquare className="h-3 w-3" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {profileUser.company && (
                      <div className="flex items-center gap-2.5">
                        <Building className="h-4 w-4 text-indigo-500 shrink-0" />
                        <span className="truncate">{profileUser.company}</span>
                      </div>
                    )}

                    {profileUser.address && (
                      <div className="flex items-center gap-2.5">
                        <MapPin className="h-4 w-4 text-indigo-500 shrink-0" />
                        <span className="truncate">{profileUser.address}</span>
                      </div>
                    )}

                    {profileUser.dateOfBirth && (
                      <div className="flex items-center gap-2.5">
                        <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
                        <span>Born {formatDate(profileUser.dateOfBirth)}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2.5">
                      <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span>Joined {formatDate(profileUser.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Building className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span>{listings.length} Properties Listed</span>
                    </div>
                  </div>

                  {profileUser.bio && (
                    <div className="w-full mt-5 p-4 bg-slate-900/50 border border-slate-850 rounded-2xl text-xs text-slate-350 leading-relaxed font-medium text-left">
                      <div className="flex items-center gap-1 text-slate-200 font-bold mb-1.5 uppercase tracking-wider text-[9px]">
                        <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                        <span>About Seller</span>
                      </div>
                      <p className="whitespace-pre-line text-slate-400">{profileUser.bio}</p>
                    </div>
                  )}

                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="w-full mt-6 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Edit Profile Details</span>
                    </button>
                  )}
                </>
              ) : (
                /* Edit Profile Form */
                <form onSubmit={handleSaveProfile} className="w-full text-left mt-1">
                  <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-center">
                    Update Details
                  </h3>
                  
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Full Name
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          disabled={isVerified}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className={`w-full px-3 py-2 bg-slate-900 border rounded-xl text-xs text-white focus:outline-none transition-all font-sans ${
                            isVerified 
                              ? "border-slate-850 text-slate-500 cursor-not-allowed bg-slate-950/80" 
                              : "border-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          }`}
                        />
                        {isVerified && (
                          <div className="absolute right-3 top-2 flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                            <ShieldCheck className="h-3 w-3" />
                            <span>Locked</span>
                          </div>
                        )}
                      </div>
                      {isVerified && (
                        <p className="text-[10px] text-slate-500 mt-1 font-medium leading-normal">
                          Your name is verified and locked to your government document.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Mobile Number
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +91 98765 43210"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={editDateOfBirth}
                        onChange={(e) => setEditDateOfBirth(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Company / Agency / Brokerage
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. LouLam Brokerage Group"
                        value={editCompany}
                        onChange={(e) => setEditCompany(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Business Address / Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mantripukhri, Imphal East"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Biography / Professional Details
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Describe your specialties, real estate experience, background..."
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans resize-none"
                      />
                    </div>
                  </div>

                  {saveError && (
                    <div className="mt-4 p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-bold leading-normal">
                      {saveError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setSaveError(null);
                        setEditPhone(profileUser?.phone || "");
                        setEditBio(profileUser?.bio || "");
                        setEditCompany(profileUser?.company || "");
                        setEditAddress(profileUser?.address || "");
                      }}
                      className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-800 hover:border-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="py-2.5 bg-indigo-600 hover:bg-indigo-755 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-75 flex items-center justify-center gap-1 cursor-pointer shadow-md"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      <span>Save</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Account Legitimacy Card */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">
              Seller Legitimacy Check
            </h3>

            {isLegitimate ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 rounded-2xl text-emerald-400">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500 animate-pulse" />
                  <div>
                    <p className="text-xs font-extrabold uppercase">Verified Legitimate</p>
                    <p className="text-[10px] text-emerald-400/80 font-medium mt-0.5">
                      Seller has {listingCount} active marketplace items
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  We verify sellers who maintain multiple active property offerings on the platform. This history demonstrates consistent marketplace participation and legitimacy.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 px-4 py-3 rounded-2xl text-amber-400">
                  <Info className="h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-xs font-extrabold uppercase">Unverified / New Account</p>
                    <p className="text-[10px] text-amber-400/80 font-medium mt-0.5">
                      Seller has {listingCount} active listings
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  This user has limited or no active listing history. For your safety, always schedule in-person tours and perform physical verification before submitting property deposits or making payments.
                </p>
              </div>
            )}
          </div>

          {/* Government ID & Legal Name Verification Card */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">
              Government ID Verification
            </h3>

            {isVerified ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 rounded-2xl text-emerald-400">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
                  <div>
                    <p className="text-xs font-extrabold uppercase">Identity Confirmed</p>
                    <p className="text-[10px] text-emerald-400/80 font-medium mt-0.5">
                      Verified Legal Name: {profileUser?.name}
                    </p>
                  </div>
                </div>
                
                <div className="text-[11px] text-slate-400 flex flex-col gap-2 font-medium">
                  <p>
                    This account is verified with a government-issued identification document. Their legal name is locked to prevent unauthorized changes.
                  </p>
                  {profileUser?.sellerVerification?.verifiedAt && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Verified on {formatDate(profileUser.sellerVerification.verifiedAt)}
                    </p>
                  )}
                  {profileUser?.sellerVerification?.documentUrls && profileUser.sellerVerification.documentUrls.length > 0 && isOwnProfile && (
                    <a
                      href={profileUser.sellerVerification.documentUrls[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline text-[10px]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>View Uploaded Government ID</span>
                    </a>
                  )}
                </div>
              </div>
            ) : isOwnProfile ? (
              <div className="flex flex-col gap-4">
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  Verify your legal name against a government document (Passport, Aadhaar Card, PAN Card, etc.) to get a verified badge and increase listing trust.
                </p>

                {verificationError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-bold leading-normal">
                    {verificationError}
                  </div>
                )}

                {isScanning ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                    <div className="w-full h-1 bg-indigo-500/20 relative rounded-full overflow-hidden">
                      <div className="absolute top-0 h-full bg-indigo-500 w-1/3 animate-shimmer" />
                    </div>
                    
                    <div className="relative h-24 w-full bg-slate-950/80 rounded-xl flex items-center justify-center overflow-hidden border border-slate-800">
                      <div className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-md shadow-indigo-400 animate-pulse" />
                      <FileText className="h-8 w-8 text-indigo-400/50" />
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
                      <span>
                        {scanStep === 0 && "Reading ID security features..."}
                        {scanStep === 1 && "Verifying government signature..."}
                        {scanStep === 2 && "Matching legal name credentials..."}
                        {scanStep === 3 && "Applying official verified registry badge..."}
                      </span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleVerifyIdentity} className="flex flex-col gap-3.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Official Legal Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="As shown on ID document"
                        value={legalNameInput}
                        onChange={(e) => setLegalNameInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Upload Government ID (Photo)
                      </label>
                      
                      {docFile ? (
                        <div className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-850 rounded-xl">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                            <span className="text-xs text-slate-200 font-medium truncate">
                              {docFile.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDocFile(null)}
                            className="text-slate-400 hover:text-white p-1"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="border border-dashed border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-900 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5">
                          <Upload className="h-4.5 w-4.5 text-indigo-500" />
                          <span className="text-xs text-slate-300 font-bold">Choose ID Document</span>
                          <span className="text-[10px] text-slate-500">PNG, JPG, WEBP (Max 5MB)</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setDocFile(e.target.files[0]);
                              }
                            }}
                            className="hidden"
                            required
                          />
                        </label>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={verifyingDoc}
                      className="w-full mt-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-650 hover:to-violet-650 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-75 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/10"
                    >
                      {verifyingDoc ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      <span>Verify Identity</span>
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-3 rounded-2xl text-slate-400">
                  <AlertCircle className="h-5 w-5 shrink-0 text-slate-500" />
                  <div>
                    <p className="text-xs font-extrabold uppercase text-slate-300">Identity Unverified</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      This user hasn&apos;t completed legal name verification
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Side: Property Listings grid */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white uppercase tracking-wider">
              {isOwnProfile ? "My Property Listings" : `${profileUser.name || "User"}'s Listings`}
            </h2>
            <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-[10px] font-bold">
              {listings.length} Total
            </span>
          </div>

          {listings.length === 0 ? (
            <div className="py-16 bg-slate-950 border border-dashed border-slate-800 rounded-3xl text-center">
              <Building className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400">No properties listed yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {isOwnProfile 
                  ? "Get started by creating your first property listing on the main dashboard!" 
                  : "This seller has no listings currently available."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  onClick={() => setSelectedListing(listing)}
                  className="group bg-slate-950 border border-slate-800 hover:border-slate-700/80 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
                >
                  {/* Image Cover */}
                  <div className="relative h-44 overflow-hidden bg-slate-900">
                    {listing.images.length > 0 ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={getOptimizedImageUrl(listing.images[0], "q_auto,f_auto,w_400,h_300,c_fill")}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <Building className="h-8 w-8" />
                      </div>
                    )}
                    
                    {/* Status Badge */}
                    <div className="absolute top-3 left-3 flex gap-1">
                      <div className="bg-slate-950/95 backdrop-blur-md px-2 py-0.5 rounded-lg border border-slate-800">
                        <span className="text-[9px] font-extrabold tracking-wide uppercase text-indigo-400">
                          {listing.propertyType}
                        </span>
                      </div>
                      
                      {isOwnProfile && (
                        <div className={`backdrop-blur-md px-2 py-0.5 rounded-lg border ${
                          listing.status === "DRAFT"
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/25"
                            : "bg-emerald-500/20 text-emerald-400 border-emerald-500/25"
                        }`}>
                          <span className="text-[9px] font-extrabold tracking-wide uppercase">
                            {listing.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Listing Info Card */}
                  <div className="p-4 flex flex-col justify-between flex-1">
                    <div className="mb-4">
                      <h3 className="font-extrabold text-sm text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {listing.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                        {listing.description}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-1 text-slate-500 mb-3.5">
                        <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="text-[10px] font-semibold truncate leading-none">
                          {listing.address}
                        </span>
                      </div>

                      {/* Price row */}
                      <div className="flex justify-between items-center pt-2.5 border-t border-slate-900">
                        <span className="font-extrabold text-sm text-indigo-400">
                          {formatPrice(listing.price)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors uppercase tracking-wider flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>View Detail</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Selected Listing Detail Modal Popup */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Image Slider */}
            <div className="relative h-60 w-full bg-slate-950 group">
              {selectedListing.images.length > 0 ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={getOptimizedImageUrl(
                    selectedListing.images[detailImageIndex] || selectedListing.images[0],
                    "q_auto,f_auto,w_800,h_480,c_fill"
                  )}
                  alt={`${selectedListing.title} - Image ${detailImageIndex + 1}`}
                  className="w-full h-full object-cover transition-all duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <Building className="h-12 w-12" />
                </div>
              )}
              
              {/* Navigation Controls */}
              {selectedListing.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailImageIndex((prev) => 
                        prev === 0 ? selectedListing.images.length - 1 : prev - 1
                      );
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-10"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailImageIndex((prev) => 
                        (prev + 1) % selectedListing.images.length
                      );
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-10"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  
                  {/* Indicators / Dot Pagination */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full z-10">
                    {selectedListing.images.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailImageIndex(idx);
                        }}
                        className={`h-1.5 w-1.5 rounded-full transition-all cursor-pointer ${
                          detailImageIndex === idx ? "bg-white w-3" : "bg-white/50 hover:bg-white/80"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={() => {
                  setSelectedListing(null);
                  setDetailImageIndex(0);
                }}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/75 rounded-full text-white transition-colors cursor-pointer z-10"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="absolute bottom-4 left-4 flex gap-2 z-10">
                <div className="bg-slate-950/95 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-sm border border-slate-800">
                  <span className="text-xs font-extrabold tracking-wide uppercase text-indigo-400">
                    {selectedListing.propertyType}
                  </span>
                </div>
                {selectedListing.status && (
                  <div className={`backdrop-blur-md px-2.5 py-1 rounded-xl shadow-sm border ${
                    selectedListing.status === "DRAFT"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/25"
                      : "bg-emerald-500/20 text-emerald-400 border-emerald-500/25"
                  }`}>
                    <span className="text-xs font-extrabold tracking-wide uppercase">
                      {selectedListing.status}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 text-left">
              <div className="flex justify-between items-start gap-4 mb-2">
                <h3 className="font-extrabold text-xl text-white">
                  {selectedListing.title}
                </h3>
                <span className="font-extrabold text-xl text-indigo-400 shrink-0">
                  {formatPrice(selectedListing.price)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-500 mb-4">
                <MapPin className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="text-xs font-semibold">{selectedListing.address}</span>
              </div>

              <div className="h-px bg-slate-800 my-4" />

              <h4 className="font-bold text-sm text-white mb-1.5">Overview</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                {selectedListing.description}
              </p>

              {/* Close Button CTA */}
              <button
                type="button"
                onClick={() => {
                  setSelectedListing(null);
                  setDetailImageIndex(0);
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                Close Listing Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
