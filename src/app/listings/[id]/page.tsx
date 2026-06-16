import { notFound } from "next/navigation";
import { ListingsService } from "@/services/listings.service";
import { SpatialService } from "@/services/spatial.service";
import { PriceEstimationService } from "@/services/price-estimation.service";
import { auth } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import { DynamicPropertyDetailsMap } from "@/components/dynamic-property-details-map";
import { ImageGallery } from "@/components/image-gallery";
import { getOptimizedImageUrl } from "@/lib/image-utils";
import { ContactSellerButton } from "@/components/contact-seller-button";
import { 
  MapPin, 
  Building, 
  ArrowLeft, 
  Mail, 
  Compass, 
  Ruler, 
  TrendingUp, 
  Sparkles, 
  Layers, 
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  User as UserIcon
} from "lucide-react";
import type { Metadata } from "next";

interface PropertyPageProps {
  params: Promise<{ id: string }>;
}

// Generate Dynamic SEO Metadata
export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const listing = await ListingsService.getListingById(id);
    return {
      title: `${listing.title} | ${listing.address} | LouLam`,
      description: `${listing.description.substring(0, 160)}...`,
      openGraph: {
        title: listing.title,
        description: listing.description,
        images: listing.images && listing.images.length > 0 ? [listing.images[0]] : [],
      },
    };
  } catch {
    return {
      title: "Property Details | LouLam",
      description: "View real estate property specifications, interactive map boundaries, and PostGIS spatial valuations.",
    };
  }
}

export default async function PropertyDetailPage({ params }: PropertyPageProps) {
  const { id } = await params;
  
  // 1. Fetch listing details
  let listing;
  try {
    listing = await ListingsService.getListingById(id);
  } catch {
    notFound();
  }

  // 2. Auth checks for drafts
  const session = await auth();
  const isOwner = session?.user?.id === listing.ownerId;
  if (listing.status === "DRAFT" && !isOwner) {
    notFound();
  }

  // 3. Parallel fetch suggestions & price estimate (to prevent waterfall delays)
  const [nearbyListings, priceEstimate] = await Promise.all([
    SpatialService.searchNearby(listing.latitude, listing.longitude, 5000), // 5km
    listing.areaSqft
      ? PriceEstimationService.estimatePrice(
          listing.latitude,
          listing.longitude,
          listing.propertyType,
          listing.areaSqft
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Filter recommendations (omit current property, take top 4)
  const recommendations = nearbyListings
    .filter((item) => item.id !== listing.id)
    .slice(0, 4);

  // Format price helper
  const formatPrice = (p: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(p);
  };

  // Check if owner is verified
  const isOwnerVerified = listing.owner?.sellerVerification?.status === "APPROVED";

  // Construct JSON-LD Schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": listing.title,
    "description": listing.description,
    "datePosted": listing.createdAt.toISOString(),
    "priceCurrency": "INR",
    "price": listing.price.toString(),
    "address": {
      "@type": "PostalAddress",
      "streetAddress": listing.address,
      "addressLocality": "Imphal",
      "addressRegion": "Manipur",
      "addressCountry": "IN",
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-16 transition-colors">
      {/* Dynamic JSON-LD Structured Data Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 h-16 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1.5 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:scale-[1.02] active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-1.5 rounded-lg text-white">
              <Compass className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-sm tracking-wide bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent hidden sm:inline">
              LouLam
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Breadcrumb trail */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500 mb-6">
          <Link href="/" className="hover:text-indigo-600 transition-colors">Home</Link>
          <span>/</span>
          <span className="capitalize">{listing.propertyType.toLowerCase()}s</span>
          <span>/</span>
          <span className="text-slate-600 dark:text-slate-300 truncate max-w-[200px] sm:max-w-xs">{listing.title}</span>
        </nav>

        {/* 2-Column Desktop Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Info Column (Left 2/3) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Gallery Wrapper */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-4 shadow-sm">
              <ImageGallery images={listing.images} title={listing.title} />
            </div>

            {/* Listing Header Metadata */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
              <div className="flex flex-wrap gap-2.5">
                <span className="inline-block px-3 py-1 text-xs font-bold tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl uppercase">
                  {listing.propertyType}
                </span>
                
                {listing.status && (
                  <span className={`inline-block px-3 py-1 text-xs font-bold tracking-wider rounded-xl uppercase ${
                    listing.status === "ACTIVE" 
                      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                      : "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                  }`}>
                    {listing.status}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
                    {listing.title}
                  </h1>
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mt-2 text-sm font-semibold">
                    <MapPin className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                    <span>{listing.address}</span>
                  </div>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <div className="text-2xl md:text-3xl font-black text-indigo-600 dark:text-indigo-400">
                    {formatPrice(listing.price)}
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold text-slate-400 mt-0.5 tracking-wider uppercase">
                    Asking Price
                  </div>
                </div>
              </div>
            </div>

            {/* Overview / Description */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-500" />
                <span>Property Overview</span>
              </h2>
              <div className="h-px bg-slate-100 dark:bg-slate-800" />
              <p className="text-slate-600 dark:text-slate-350 text-sm md:text-base leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            </div>

            {/* Technical Specifications Grid */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="h-5 w-5 text-indigo-500" />
                <span>Spatial & Property Specifications</span>
              </h2>
              <div className="h-px bg-slate-100 dark:bg-slate-800" />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                    Property Type
                  </span>
                  <span className="text-sm font-extrabold capitalize text-indigo-600 dark:text-indigo-400">
                    {listing.propertyType.toLowerCase()}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                    Calculated Area
                  </span>
                  <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <Ruler className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>{listing.areaSqft ? `${listing.areaSqft.toLocaleString()} sqft` : "N/A"}</span>
                  </span>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                    Latitude
                  </span>
                  <span className="text-sm font-extrabold text-slate-700 dark:text-slate-350">
                    {listing.latitude.toFixed(6)}°
                  </span>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                    Longitude
                  </span>
                  <span className="text-sm font-extrabold text-slate-700 dark:text-slate-350">
                    {listing.longitude.toFixed(6)}°
                  </span>
                </div>
              </div>
            </div>

            {/* Nearby Listings Suggestions Grid */}
            <div className="space-y-4">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="h-5.5 w-5.5 text-indigo-500 animate-pulse" />
                <span>Nearby Properties in the Area</span>
              </h2>
              
              {recommendations.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl">
                  No other active listings found in this immediate spatial cluster.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recommendations.map((item) => (
                    <Link
                      key={item.id}
                      href={`/listings/${item.id}`}
                      className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <div className="relative aspect-[16/10] w-full bg-slate-900 overflow-hidden">
                        {item.imageUrl ? (
                          <Image
                            src={getOptimizedImageUrl(item.imageUrl, "q_auto,f_auto,w_400,h_250,c_fill")}
                            alt={item.title}
                            fill
                            sizes="(max-width: 640px) 100vw, 300px"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600">
                            <Building className="h-10 w-10 stroke-[1.5]" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-lg text-[9px] font-bold text-white tracking-wider uppercase">
                          {item.propertyType}
                        </div>
                        <div className="absolute bottom-3 right-3 px-2 py-0.5 bg-indigo-600 backdrop-blur-md rounded-lg text-[9px] font-bold text-white tracking-wider">
                          {(item.distanceMeters / 1000).toFixed(1)} km away
                        </div>
                      </div>
                      <div className="p-5 space-y-2">
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-semibold truncate leading-none">
                          {item.address}
                        </p>
                        <div className="pt-2 flex items-center justify-between">
                          <span className="font-black text-sm text-indigo-600 dark:text-indigo-400">
                            {formatPrice(item.price)}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-0.5">
                            <span>Details</span>
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Sticky Sidebar Column (Right 1/3) */}
          <div className="space-y-8">
            
            {/* 1. Spatial Valuation Estimate Card */}
            <div className="bg-gradient-to-tr from-white to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/20 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm space-y-5 relative overflow-hidden">
              {/* Decorative gradient blur background */}
              <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none"></div>

              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                  <span>Spatial Valuation</span>
                </h3>

                {priceEstimate && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${
                    priceEstimate.confidence === "HIGH" 
                      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                      : priceEstimate.confidence === "MEDIUM" 
                        ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                        : "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40"
                  }`}>
                    {priceEstimate.confidence} Confidence
                  </span>
                )}
              </div>

              {priceEstimate ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                      Estimated Market Valuation
                    </div>
                    <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                      {formatPrice(priceEstimate.estimatedPrice)}
                    </div>
                  </div>

                  <div className="h-px bg-slate-100 dark:bg-slate-800/80" />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Estimate Range
                      </div>
                      <div className="text-xs font-extrabold text-slate-700 dark:text-slate-350 mt-0.5">
                        {formatPrice(priceEstimate.priceRange.min)} - {formatPrice(priceEstimate.priceRange.max)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Avg Price / Sqft
                      </div>
                      <div className="text-xs font-extrabold text-slate-700 dark:text-slate-350 mt-0.5">
                        {formatPrice(priceEstimate.avgPricePerSqft)}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-start gap-2">
                    <Sparkles className="h-4.5 w-4.5 shrink-0 mt-0.5 text-indigo-500" />
                    <p className="leading-relaxed">
                      Generated from <strong>{priceEstimate.comparableCount} comparable active listings</strong> within a {priceEstimate.radiusMetersUsed >= 1000 ? `${priceEstimate.radiusMetersUsed / 1000}km` : `${priceEstimate.radiusMetersUsed}m`} radius.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
                  <p className="leading-relaxed">
                    Valuation estimate unavailable. Estimates require a valid polygon boundary and a minimum of 3 comparable local listings in the database.
                  </p>
                </div>
              )}
            </div>

            {/* 2. Interactive Polygon Boundary Map Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-4 shadow-sm space-y-4">
              <div className="px-2 pt-2 flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-5 w-5 text-indigo-500" />
                  <span>Boundary Map</span>
                </h3>
                {listing.polygon && (
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-lg uppercase tracking-wide">
                    Polygon Set
                  </span>
                )}
              </div>
              <div className="h-[380px] w-full rounded-2xl overflow-hidden relative border border-slate-100 dark:border-slate-800">
                <DynamicPropertyDetailsMap
                  latitude={listing.latitude}
                  longitude={listing.longitude}
                  polygon={listing.polygon}
                  nearbyListings={nearbyListings}
                  title={listing.title}
                  price={listing.price}
                />
              </div>
            </div>

            {/* 3. Seller Contact Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm space-y-6">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <UserIcon className="h-5 w-5 text-indigo-500" />
                <span>Seller Profile</span>
              </h3>
              
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 bg-indigo-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200/40 dark:border-slate-800 flex items-center justify-center shrink-0">
                  {listing.owner?.image ? (
                    <Image
                      src={getOptimizedImageUrl(listing.owner.image, "q_auto,f_auto,w_100,h_100,c_fill")}
                      alt={listing.owner.name || "Seller"}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <UserIcon className="h-6 w-6 text-indigo-500" />
                  )}
                </div>

                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-slate-900 dark:text-white truncate">
                      {listing.owner?.name || "Anonymous Seller"}
                    </span>
                    {isOwnerVerified && (
                      <span className="text-emerald-500 hover:text-emerald-600 shrink-0" title="Government ID Verified Legal Name">
                        <ShieldCheck className="h-4.5 w-4.5 fill-emerald-500/10" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Verified Agent / Seller
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <ContactSellerButton
                  ownerName={listing.owner?.name || null}
                  ownerPhone={listing.owner?.phone || null}
                />
                
                <Link
                  href={`/chat?propertyId=${listing.id}&receiverId=${listing.ownerId}`}
                  className="flex items-center justify-center gap-2 w-full py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-slate-700 dark:text-slate-350"
                >
                  <Mail className="h-4 w-4 text-indigo-500" />
                  <span>Send Message</span>
                </Link>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
