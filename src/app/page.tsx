"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DynamicMap } from "@/components/dynamic-map";
import { ImageUploader } from "@/components/image-uploader";
import { DocumentUploader } from "@/components/document-uploader";
import { PropertyType } from "@/types/db";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { getOptimizedImageUrl } from "@/lib/image-utils";
import { DynamicBoundaryEditor } from "@/components/dynamic-boundary-editor";
import { DynamicLocationPicker } from "@/components/dynamic-location-picker";
import { coordinatesToWkt, calculatePolygonArea, validatePolygon } from "@/lib/polygon-utils";
import {
  MapPin,
  Home,
  Search,
  Compass,
  ArrowUpDown,
  Building,
  X,
  Heart,
  Phone,
  Mail,
  Loader2,
  Locate,
  LogOut,
  LogIn,
  UserPlus,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Shield,
  AlertTriangle,
  Menu
} from "lucide-react";

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  address: string;
  propertyType: PropertyType;
  status: string;
  images: string[];
  latitude: number;
  longitude: number;
  ownerId: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  polygon?: {
    type: "Polygon";
    coordinates: number[][][];
  } | null;
  areaSqft?: number | null;
}

export default function MarketplaceDashboard() {
  const { data: session } = useSession();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mobile layout state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileListView, setIsMobileListView] = useState(false);
  const [isMobileFiltersExpanded, setIsMobileFiltersExpanded] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [autocompleteResults, setAutocompleteResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [propertyType, setPropertyType] = useState<string>("ALL");
  const [maxPrice, setMaxPrice] = useState<number>(50000000);
  const minPrice = 0;
  const [mapFilterEnabled, setMapFilterEnabled] = useState(true);
  const [radialSearchEnabled, setRadialSearchEnabled] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState(5000);

  // Map state
  const [mapCenter, setMapCenter] = useState<[number, number]>([24.8170, 93.9368]); // Imphal, Manipur defaults
  const [mapBounds, setMapBounds] = useState<{
    south: number;
    west: number;
    north: number;
    east: number;
  } | null>(null);

  // Selected Listing Modal state
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const [locating, setLocating] = useState(false);

  const handleSelectListing = (listing: Listing | null) => {
    setSelectedListing(listing);
    setDetailImageIndex(0);
  };

  // Create Listing Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPrice, setCreatePrice] = useState("");
  const [createAddress, setCreateAddress] = useState("");
  const [createPropertyType, setCreatePropertyType] = useState<PropertyType>("HOUSE");
  const [createLatitude, setCreateLatitude] = useState("24.8170");
  const [createLongitude, setCreateLongitude] = useState("93.9368");
  const [createImages, setCreateImages] = useState<string[]>([]);
  const [createImageHashes, setCreateImageHashes] = useState<string[]>([]);
  const [createImagesUploading, setCreateImagesUploading] = useState(false);
  const [createDocumentUrl, setCreateDocumentUrl] = useState("");
  const [createDocumentHash, setCreateDocumentHash] = useState("");
  const [createStatus, setCreateStatus] = useState<"ACTIVE" | "DRAFT" | "SOLD" | "IN_TALK">("ACTIVE");
  const [createPolygonCoords, setCreatePolygonCoords] = useState<[number, number][]>([]);
  const [isCreateBoundaryModalOpen, setIsCreateBoundaryModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Area & Price Calculator State & Handlers for Create Listing
  const [createAreaSqft, setCreateAreaSqft] = useState("");
  const [createAreaSqm, setCreateAreaSqm] = useState("");
  const [createPricePerSqft, setCreatePricePerSqft] = useState("");

  const handleCreateAreaSqftChange = (val: string) => {
    setCreateAreaSqft(val);
    const numArea = parseFloat(val);
    if (!isNaN(numArea) && numArea > 0) {
      setCreateAreaSqm((numArea / 10.76391).toFixed(2));
      if (createPrice) {
        setCreatePricePerSqft((parseFloat(createPrice) / numArea).toFixed(2));
      } else if (createPricePerSqft) {
        setCreatePrice(Math.round(parseFloat(createPricePerSqft) * numArea).toString());
      }
    } else {
      setCreateAreaSqm("");
      setCreatePricePerSqft("");
    }
  };

  const handleCreateAreaSqmChange = (val: string) => {
    setCreateAreaSqm(val);
    const numArea = parseFloat(val);
    if (!isNaN(numArea) && numArea > 0) {
      const sqft = Math.round(numArea * 10.76391);
      setCreateAreaSqft(sqft.toString());
      if (createPrice) {
        setCreatePricePerSqft((parseFloat(createPrice) / sqft).toFixed(2));
      } else if (createPricePerSqft) {
        setCreatePrice(Math.round(parseFloat(createPricePerSqft) * sqft).toString());
      }
    } else {
      setCreateAreaSqft("");
      setCreatePricePerSqft("");
    }
  };

  const handleCreatePriceChange = (val: string) => {
    setCreatePrice(val);
    const priceVal = parseFloat(val);
    const areaVal = parseFloat(createAreaSqft);
    const ppsfVal = parseFloat(createPricePerSqft);

    if (!isNaN(priceVal) && priceVal > 0) {
      if (!isNaN(areaVal) && areaVal > 0) {
        setCreatePricePerSqft((priceVal / areaVal).toFixed(2));
      } else if (!isNaN(ppsfVal) && ppsfVal > 0) {
        const calculatedArea = Math.round(priceVal / ppsfVal);
        setCreateAreaSqft(calculatedArea.toString());
        setCreateAreaSqm((calculatedArea / 10.76391).toFixed(2));
      }
    } else {
      if (!isNaN(areaVal) && areaVal > 0) {
        setCreatePricePerSqft("");
      }
    }
  };

  const handleCreatePricePerSqftChange = (val: string) => {
    setCreatePricePerSqft(val);
    const ppsfVal = parseFloat(val);
    const areaVal = parseFloat(createAreaSqft);
    const priceVal = parseFloat(createPrice);

    if (!isNaN(ppsfVal) && ppsfVal > 0) {
      if (!isNaN(areaVal) && areaVal > 0) {
        setCreatePrice(Math.round(ppsfVal * areaVal).toString());
      } else if (!isNaN(priceVal) && priceVal > 0) {
        const calculatedArea = Math.round(priceVal / ppsfVal);
        setCreateAreaSqft(calculatedArea.toString());
        setCreateAreaSqm((calculatedArea / 10.76391).toFixed(2));
      }
    } else {
      if (!isNaN(areaVal) && areaVal > 0) {
        setCreatePrice("");
      }
    }
  };

  // Synchronize calculated area in sq ft when polygon coords change
  useEffect(() => {
    if (createPolygonCoords.length >= 3) {
      const areaSqm = calculatePolygonArea(createPolygonCoords);
      setCreateAreaSqm(areaSqm.toFixed(2));
      const areaSqft = Math.round(areaSqm * 10.76391);
      setCreateAreaSqft(areaSqft.toString());
      if (createPrice) {
        setCreatePricePerSqft((parseFloat(createPrice) / areaSqft).toFixed(2));
      } else if (createPricePerSqft) {
        setCreatePrice(Math.round(parseFloat(createPricePerSqft) * areaSqft).toString());
      }
    }
  }, [createPolygonCoords]);


  // Handle listing submission
  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle || !createDescription || !createPrice || !createAddress || !createLatitude || !createLongitude) {
      alert("Please fill in all required fields.");
      return;
    }

    if (createDescription.length < 10) {
      alert("Description must be at least 10 characters.");
      return;
    }

    if (createAddress.length < 5) {
      alert("Address must be at least 5 characters.");
      return;
    }

    if (createImagesUploading) {
      alert("Photos are still uploading. Please wait a moment then try again.");
      return;
    }

    if (createImages.length === 0) {
      alert("Please upload at least one property image.");
      return;
    }

    if (!createDocumentUrl || !createDocumentHash) {
      alert("Please upload the required property verification document.");
      return;
    }

    try {
      setCreateSubmitting(true);
      const lat = parseFloat(createLatitude);
      const lng = parseFloat(createLongitude);
      
      let polygonWkt = "";
      if (createPolygonCoords.length >= 3) {
        polygonWkt = coordinatesToWkt(createPolygonCoords);
      } else if (createAreaSqft && parseFloat(createAreaSqft) > 0) {
        const areaSqftVal = parseFloat(createAreaSqft);
        const areaSqm = areaSqftVal / 10.76391;
        const sideMeters = Math.sqrt(areaSqm);
        const latOffset = (sideMeters / 111320) / 2;
        const lngOffset = (sideMeters / (111320 * Math.cos((lat * Math.PI) / 180))) / 2;
        polygonWkt = `POLYGON((${lng - lngOffset} ${lat - latOffset}, ${lng + lngOffset} ${lat - latOffset}, ${lng + lngOffset} ${lat + latOffset}, ${lng - lngOffset} ${lat + latOffset}, ${lng - lngOffset} ${lat - latOffset}))`;
      } else {
        const offset = 0.0015; // Generates ~150 meter polygon boundary centered at coordinate
        polygonWkt = `POLYGON((${lng - offset} ${lat - offset}, ${lng + offset} ${lat - offset}, ${lng + offset} ${lat + offset}, ${lng - offset} ${lat + offset}, ${lng - offset} ${lat - offset}))`;
      }

      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle,
          description: createDescription,
          price: parseFloat(createPrice),
          address: createAddress,
          propertyType: createPropertyType,
          latitude: lat,
          longitude: lng,
          images: createImages,
          imageHashes: createImageHashes,
          documentUrl: createDocumentUrl,
          documentHash: createDocumentHash,
          polygonWkt,
          status: createStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to create listing.");
      }

      alert("Property listed successfully!");
      setIsCreateModalOpen(false);

      // Reset form
      setCreateTitle("");
      setCreateDescription("");
      setCreatePrice("");
      setCreateAddress("");
      setCreatePropertyType("HOUSE");
      setCreateImages([]);
      setCreateImageHashes([]);
      setCreateDocumentUrl("");
      setCreateDocumentHash("");
      setCreateStatus("ACTIVE");
      setCreatePolygonCoords([]);
      setCreateAreaSqft("");
      setCreateAreaSqm("");
      setCreatePricePerSqft("");

      // Reload active listings
      fetchListings();
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "An error occurred while listing the property.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Edit / Delete Listing States & Handlers
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPropertyType, setEditPropertyType] = useState<PropertyType>("HOUSE");
  const [editLatitude, setEditLatitude] = useState("");
  const [editLongitude, setEditLongitude] = useState("");
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editImageHashes, setEditImageHashes] = useState<string[]>([]);
  const [editDocumentUrl, setEditDocumentUrl] = useState("");
  const [editDocumentHash, setEditDocumentHash] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "DRAFT" | "SOLD" | "IN_TALK">("ACTIVE");
  const [editPolygonCoords, setEditPolygonCoords] = useState<[number, number][]>([]);
  const [isEditBoundaryModalOpen, setIsEditBoundaryModalOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Area & Price Calculator State & Handlers for Edit Listing
  const [editAreaSqft, setEditAreaSqft] = useState("");
  const [editAreaSqm, setEditAreaSqm] = useState("");
  const [editPricePerSqft, setEditPricePerSqft] = useState("");

  const handleEditAreaSqftChange = (val: string) => {
    setEditAreaSqft(val);
    const numArea = parseFloat(val);
    if (!isNaN(numArea) && numArea > 0) {
      setEditAreaSqm((numArea / 10.76391).toFixed(2));
      if (editPrice) {
        setEditPricePerSqft((parseFloat(editPrice) / numArea).toFixed(2));
      } else if (editPricePerSqft) {
        setEditPrice(Math.round(parseFloat(editPricePerSqft) * numArea).toString());
      }
    } else {
      setEditAreaSqm("");
      setEditPricePerSqft("");
    }
  };

  const handleEditAreaSqmChange = (val: string) => {
    setEditAreaSqm(val);
    const numArea = parseFloat(val);
    if (!isNaN(numArea) && numArea > 0) {
      const sqft = Math.round(numArea * 10.76391);
      setEditAreaSqft(sqft.toString());
      if (editPrice) {
        setEditPricePerSqft((parseFloat(editPrice) / sqft).toFixed(2));
      } else if (editPricePerSqft) {
        setEditPrice(Math.round(parseFloat(editPricePerSqft) * sqft).toString());
      }
    } else {
      setEditAreaSqft("");
      setEditPricePerSqft("");
    }
  };

  const handleEditPriceChange = (val: string) => {
    setEditPrice(val);
    const priceVal = parseFloat(val);
    const areaVal = parseFloat(editAreaSqft);
    const ppsfVal = parseFloat(editPricePerSqft);

    if (!isNaN(priceVal) && priceVal > 0) {
      if (!isNaN(areaVal) && areaVal > 0) {
        setEditPricePerSqft((priceVal / areaVal).toFixed(2));
      } else if (!isNaN(ppsfVal) && ppsfVal > 0) {
        const calculatedArea = Math.round(priceVal / ppsfVal);
        setEditAreaSqft(calculatedArea.toString());
        setEditAreaSqm((calculatedArea / 10.76391).toFixed(2));
      }
    } else {
      if (!isNaN(areaVal) && areaVal > 0) {
        setEditPricePerSqft("");
      }
    }
  };

  const handleEditPricePerSqftChange = (val: string) => {
    setEditPricePerSqft(val);
    const ppsfVal = parseFloat(val);
    const areaVal = parseFloat(editAreaSqft);
    const priceVal = parseFloat(editPrice);

    if (!isNaN(ppsfVal) && ppsfVal > 0) {
      if (!isNaN(areaVal) && areaVal > 0) {
        setEditPrice(Math.round(ppsfVal * areaVal).toString());
      } else if (!isNaN(priceVal) && priceVal > 0) {
        const calculatedArea = Math.round(priceVal / ppsfVal);
        setEditAreaSqft(calculatedArea.toString());
        setEditAreaSqm((calculatedArea / 10.76391).toFixed(2));
      }
    } else {
      if (!isNaN(areaVal) && areaVal > 0) {
        setEditPrice("");
      }
    }
  };

  // Synchronize calculated area in sq ft when polygon coords change
  useEffect(() => {
    if (editPolygonCoords.length >= 3) {
      const areaSqm = calculatePolygonArea(editPolygonCoords);
      setEditAreaSqm(areaSqm.toFixed(2));
      const areaSqft = Math.round(areaSqm * 10.76391);
      setEditAreaSqft(areaSqft.toString());
      if (editPrice) {
        setEditPricePerSqft((parseFloat(editPrice) / areaSqft).toFixed(2));
      } else if (editPricePerSqft) {
        setEditPrice(Math.round(parseFloat(editPricePerSqft) * areaSqft).toString());
      }
    }
  }, [editPolygonCoords]);

  const handleOpenEditModal = (listing: Listing) => {
    setEditId(listing.id);
    setEditTitle(listing.title);
    setEditDescription(listing.description);
    setEditPrice(listing.price.toString());
    setEditAddress(listing.address);
    setEditPropertyType(listing.propertyType);
    setEditLatitude(listing.latitude.toString());
    setEditLongitude(listing.longitude.toString());
    setEditImages(listing.images || []);
    setEditImageHashes((listing as any).imageHashes || []);
    setEditDocumentUrl((listing as any).documentUrl || "");
    setEditDocumentHash((listing as any).documentHash || "");
    setEditStatus((listing.status as "ACTIVE" | "DRAFT" | "SOLD" | "IN_TALK") || "ACTIVE");

    // Extract boundary polygon coordinates if they exist
    const initialCoords = listing.polygon && listing.polygon.type === "Polygon"
      ? listing.polygon.coordinates[0].map(pt => [pt[1], pt[0]] as [number, number])
      : [];
    
    // Remove the repeated point at the end
    if (initialCoords.length > 1) {
      const first = initialCoords[0];
      const last = initialCoords[initialCoords.length - 1];
      if (first[0] === last[0] && first[1] === last[1]) {
        initialCoords.pop();
      }
    }
    setEditPolygonCoords(initialCoords);
    if (listing.areaSqft) {
      setEditAreaSqft(listing.areaSqft.toString());
      setEditAreaSqm((listing.areaSqft / 10.76391).toFixed(2));
      setEditPricePerSqft((listing.price / listing.areaSqft).toFixed(2));
    } else if (initialCoords.length >= 3) {
      const areaSqm = calculatePolygonArea(initialCoords);
      setEditAreaSqm(areaSqm.toFixed(2));
      const areaSqft = Math.round(areaSqm * 10.76391);
      setEditAreaSqft(areaSqft.toString());
      setEditPricePerSqft((listing.price / areaSqft).toFixed(2));
    } else {
      setEditAreaSqft("");
      setEditAreaSqm("");
      setEditPricePerSqft("");
    }
    
    // Close the details modal and open the edit form
    handleSelectListing(null);
    setIsEditModalOpen(true);
  };

  const handleEditListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !editTitle || !editDescription || !editPrice || !editAddress || !editLatitude || !editLongitude) {
      alert("Please fill in all required fields.");
      return;
    }

    if (editDescription.length < 10) {
      alert("Description must be at least 10 characters.");
      return;
    }

    if (editAddress.length < 5) {
      alert("Address must be at least 5 characters.");
      return;
    }

    if (editImages.length === 0) {
      alert("Please upload at least one property image.");
      return;
    }

    if (!editDocumentUrl || !editDocumentHash) {
      alert("Please upload the required property verification document.");
      return;
    }

    try {
      setEditSubmitting(true);
      const lat = parseFloat(editLatitude);
      const lng = parseFloat(editLongitude);
      
      let polygonWkt = "";
      if (editPolygonCoords.length >= 3) {
        polygonWkt = coordinatesToWkt(editPolygonCoords);
      } else if (editAreaSqft && parseFloat(editAreaSqft) > 0) {
        const areaSqftVal = parseFloat(editAreaSqft);
        const areaSqm = areaSqftVal / 10.76391;
        const sideMeters = Math.sqrt(areaSqm);
        const latOffset = (sideMeters / 111320) / 2;
        const lngOffset = (sideMeters / (111320 * Math.cos((lat * Math.PI) / 180))) / 2;
        polygonWkt = `POLYGON((${lng - lngOffset} ${lat - latOffset}, ${lng + lngOffset} ${lat - latOffset}, ${lng + lngOffset} ${lat + latOffset}, ${lng - lngOffset} ${lat + latOffset}, ${lng - lngOffset} ${lat - latOffset}))`;
      } else {
        const offset = 0.0015;
        polygonWkt = `POLYGON((${lng - offset} ${lat - offset}, ${lng + offset} ${lat - offset}, ${lng + offset} ${lat + offset}, ${lng - offset} ${lat + offset}, ${lng - offset} ${lat - offset}))`;
      }

      const response = await fetch(`/api/listings/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          price: parseFloat(editPrice),
          address: editAddress,
          propertyType: editPropertyType,
          latitude: lat,
          longitude: lng,
          images: editImages,
          imageHashes: editImageHashes,
          documentUrl: editDocumentUrl,
          documentHash: editDocumentHash,
          polygonWkt,
          status: editStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update listing.");
      }

      alert("Listing updated successfully!");
      setIsEditModalOpen(false);
      
      // Refresh feed
      fetchListings();
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "An error occurred while updating the listing.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (!confirm("Are you sure you want to delete this listing? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/listings/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete listing.");
      }

      alert("Listing deleted successfully!");
      handleSelectListing(null);
      
      // Refresh feed
      fetchListings();
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "An error occurred while deleting the listing.");
    }
  };

  // Get user location using HTML5 Geolocation API
    const handleLocateUser = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapCenter([position.coords.latitude, position.coords.longitude]);
        setLocating(false);
        setIsMobileFiltersExpanded(false);
      },
      (err) => {
        console.error(err);
        alert("Unable to retrieve your location");
        setLocating(false);
      }
    );
  }, []);

  // Geocode search query using Nominatim API to recenter map
  const handleGeocodeSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setMapCenter([parseFloat(lat), parseFloat(lon)]);
        setIsMobileFiltersExpanded(false);
      } else {
        alert("Location not found. Please try a different search term.");
      }
    } catch (err) {
      console.error("Geocoding failed", err);
    }
  };

  // Fetch autocomplete suggestions with debounce
  useEffect(() => {
    if (!searchQuery.trim() || !showAutocomplete) {
      setAutocompleteResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=5`);
        const data = await response.json();
        setAutocompleteResults(data || []);
      } catch (err) {
        console.error("Autocomplete fetch failed", err);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, showAutocomplete]);

  const handleSelectAutocomplete = (result: { display_name: string; lat: string; lon: string }) => {
    setSearchQuery(result.display_name);
    setMapCenter([parseFloat(result.lat), parseFloat(result.lon)]);
    setShowAutocomplete(false);
    setIsMobileFiltersExpanded(false);
    setAutocompleteResults([]);
  };

  // Try to locate user on initial mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
          setRadialSearchEnabled(true);
          setMapFilterEnabled(false);
        },
        (error) => {
          console.log("Auto-locate prompt was ignored or rejected. Using default Manipur coordinates.", error);
        }
      );
    }
  }, []);

  // Load fallback data for immediate WOW effect if DB connection fails
  const loadFallbackMockData = useCallback(() => {
    const mockData: Listing[] = [
      {
        id: "mock-1",
        title: "Luxury Modern Villa in Mantripukhri",
        description: "Stunning 4 bedroom villa in the prime locality of Mantripukhri, Imphal. Features beautiful valley views, modern architectural design, spacious garden, and premium finishes.",
        price: 15000000,
        address: "Mantripukhri, Imphal East, Manipur 795002",
        propertyType: "HOUSE",
        status: "ACTIVE",
        images: ["https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80"],
        latitude: 24.8436,
        longitude: 93.9450,
        ownerId: "00000000-0000-0000-0000-000000000001",
      },
      {
        id: "mock-2",
        title: "Chic Apartment Near Kangla Fort",
        description: "Beautiful open concept 2 BHK apartment in Sagolband, close to the historic Kangla Fort, local markets, and schools. Perfect for families looking for central city life.",
        price: 4500000,
        address: "Sagolband Road, Imphal West, Manipur 795001",
        propertyType: "APARTMENT",
        status: "ACTIVE",
        images: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80"],
        latitude: 24.8040,
        longitude: 93.9210,
        ownerId: "00000000-0000-0000-0000-000000000001",
      },
      {
        id: "mock-3",
        title: "Premium Commercial Plot in Lamphelpat",
        description: "Spacious commercial land located in the thriving business hub of Lamphelpat. Ideal for retail showrooms, corporate offices, or healthcare setups.",
        price: 28000000,
        address: "Lamphelpat, Imphal West, Manipur 795004",
        propertyType: "LAND",
        status: "ACTIVE",
        images: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80"],
        latitude: 24.8210,
        longitude: 93.9160,
        ownerId: "00000000-0000-0000-0000-000000000001",
      },
      {
        id: "mock-4",
        title: "Modern Apartment in Lamphelpat",
        description: "Spacious and ventilated 3 BHK apartment in Lamphelpat with modern facilities, security, power backup, and dedicated parking space.",
        price: 7500000,
        address: "Lamphelpat, Imphal West, Manipur 795004",
        propertyType: "APARTMENT",
        status: "ACTIVE",
        images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"],
        latitude: 24.8250,
        longitude: 93.9120,
        ownerId: "00000000-0000-0000-0000-000000000002",
      },
    ];
    setListings(mockData);
  }, []);

  // Fetch listings from API
  const fetchListings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("page", "1");
      params.append("limit", "50");

      if (propertyType !== "ALL") {
        params.append("propertyType", propertyType);
      }
      if (minPrice > 0) {
        params.append("minPrice", minPrice.toString());
      }
      if (maxPrice < 50000000) {
        params.append("maxPrice", maxPrice.toString());
      }

      // Geo filtering logic
      if (mapFilterEnabled && mapBounds && !radialSearchEnabled) {
        params.append("south", mapBounds.south.toString());
        params.append("west", mapBounds.west.toString());
        params.append("north", mapBounds.north.toString());
        params.append("east", mapBounds.east.toString());
      } else if (radialSearchEnabled) {
        params.append("lat", mapCenter[0].toString());
        params.append("lng", mapCenter[1].toString());
        params.append("radius", radiusMeters.toString());
      }

      const res = await fetch(`/api/listings?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch listings");
      }
      const payload = await res.json();
      if (payload.success) {
        setListings(payload.data || []);
      } else {
        throw new Error(payload.message || "Failed to load listings");
      }
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Something went wrong";
      setError(errMsg);
      
      // Load fallback static mock data if DB isn't running/seeded yet
      loadFallbackMockData();
    } finally {
      setLoading(false);
    }
  }, [propertyType, minPrice, maxPrice, mapFilterEnabled, mapBounds, radialSearchEnabled, mapCenter, radiusMeters, loadFallbackMockData]);

  // Fetch listings on parameter changes
  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const [expiredListings, setExpiredListings] = useState<any[]>([]);

  useEffect(() => {
    if (session?.user?.id) {
      fetch("/api/user/reminder-check", {
        method: "POST",
      })
        .then((res) => res.json())
        .then((resData) => {
          if (resData.success && Array.isArray(resData.data)) {
            setExpiredListings(resData.data);
          }
        })
        .catch((err) => console.error("Error checking reminders:", err));
    } else {
      setExpiredListings([]);
    }
  }, [session]);

  const handleReminderAction = async (id: string, action: "sold" | "in_talk" | "keep" | "remove") => {
    try {
      if (action === "remove") {
        if (!confirm("Are you sure you want to remove this property listing?")) return;
        const res = await fetch(`/api/listings/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete listing");
        alert("Listing removed successfully!");
      } else if (action === "keep") {
        const res = await fetch(`/api/listings/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            createdAt: new Date().toISOString(),
            lastReminderSentAt: null
          }),
        });
        if (!res.ok) throw new Error("Failed to renew listing");
        alert("Listing renewed successfully!");
      } else {
        const statusVal = action === "sold" ? "SOLD" : "IN_TALK";
        const res = await fetch(`/api/listings/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusVal }),
        });
        if (!res.ok) throw new Error("Failed to update status");
        alert(`Listing marked as ${action === "sold" ? "Sold" : "In Talk"}!`);
      }
      // Remove from banner list and refresh marketplace
      setExpiredListings((prev) => prev.filter((item) => item.id !== id));
      fetchListings();
    } catch (err) {
      console.error(err);
      alert("Failed to perform action. Please try again.");
    }
  };

  // Handle map bounds changes from Leaflet
  const handleBoundsChange = useCallback((bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  }) => {
    setMapBounds(bounds);
  }, []);

  // Center map on listing click
  const handleListingClick = (listing: Listing) => {
    setMapCenter([listing.latitude, listing.longitude]);
  };

  // Format currency
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const filteredListings = listings.filter(
    (listing) =>
      listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      listing.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-black text-slate-950 dark:text-slate-50 font-sans selection:bg-indigo-500/30">
      {/* Premium Header */}
      <header className="hidden sm:block sticky top-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-white/60 dark:border-slate-800/50 transition-colors shadow-sm shadow-slate-900/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/loulam-logo.png" alt="LouLam" className="h-10 w-auto" />
          </div>

          <div className="flex items-center gap-4">
            {session ? (
              <>
                  <button 
                    onClick={() => {
                      setCreateLatitude(mapCenter[0].toFixed(6));
                      setCreateLongitude(mapCenter[1].toFixed(6));
                      setIsCreateModalOpen(true);
                    }}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 border border-slate-200/50 dark:border-slate-800 bg-white/50 backdrop-blur-md hover:bg-slate-100/80 dark:hover:bg-slate-800 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm shadow-slate-900/5"
                  >
                    <Building className="h-4 w-4 text-indigo-500" />
                    List Property
                  </button>

                <Link
                  href="/chat"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-slate-700 dark:text-slate-200"
                >
                  <MessageSquare className="h-4 w-4 text-indigo-500" />
                  Inbox
                </Link>

                {session.user?.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-md"
                  >
                    <Shield className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
                    Admin
                  </Link>
                )}

                <Link
                  href="/profile"
                  className="hidden md:flex flex-col items-end group"
                >
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {session.user.name || session.user.email}
                  </span>
                  <span className="text-[10px] text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors">
                    View Profile
                  </span>
                </Link>

                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-2 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:flex items-center gap-2 px-3.5 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-slate-700 dark:text-slate-200"
                >
                  <LogIn className="h-4 w-4 text-slate-400" />
                  <span>Log In</span>
                </Link>

                <Link
                  href="/register"
                  className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Register</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Side Drawer */}
      {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[100] flex sm:hidden">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Sidebar */}
            <div className="relative w-4/5 max-w-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 ease-out ml-auto border-l border-white/40 dark:border-slate-700/50">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span className="font-bold text-lg">Menu</span>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {session ? (
                  <>
                    <div className="mb-4">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {session.user.name || session.user.email}
                      </p>
                      <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)} className="text-xs text-indigo-600 dark:text-indigo-400">
                        View Profile
                      </Link>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setCreateLatitude(mapCenter[0].toFixed(6));
                        setCreateLongitude(mapCenter[1].toFixed(6));
                        setIsCreateModalOpen(true);
                      }}
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                    >
                      <Building className="h-5 w-5 text-indigo-500" />
                      <span className="font-medium">List Property</span>
                    </button>

                    <Link href="/chat" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <MessageSquare className="h-5 w-5 text-indigo-500" />
                      <span className="font-medium">Inbox</span>
                    </Link>

                    {session.user?.role === "ADMIN" && (
                      <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <Shield className="h-5 w-5 text-emerald-500" />
                        <span className="font-medium">Admin Panel</span>
                      </Link>
                    )}

                    <div className="mt-auto pt-4">
                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl font-semibold"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <LogIn className="h-5 w-5 text-slate-500" />
                      <span className="font-medium">Log In</span>
                    </Link>
                    <Link href="/register" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <UserPlus className="h-5 w-5" />
                      <span className="font-medium">Register</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      <main className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-6 h-[100dvh] sm:h-[calc(100vh-64px)] flex flex-col relative z-0 overflow-hidden sm:overflow-visible">
        {expiredListings.length > 0 && (
          <div className="bg-amber-500/10 dark:bg-amber-500/5 backdrop-blur-xl border border-amber-500/20 rounded-[2rem] p-6 mb-6 mx-4 sm:mx-0 mt-4 sm:mt-0 relative z-20 shadow-xl shadow-amber-900/5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-extrabold text-slate-900 dark:text-white text-base mb-1.5 leading-snug">
                  Listing Status Reminder
                </h4>
                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed mb-4">
                  The following properties have been listed for more than 2 months. Please verify if they are still available, in talk, sold, or if they should be removed.
                </p>

                <div className="flex flex-col gap-4">
                  {expiredListings.map((prop) => (
                    <div
                      key={prop.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl"
                    >
                      <div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md">
                          {prop.propertyType}
                        </span>
                        <h5 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mt-1 line-clamp-1">
                          {prop.title}
                        </h5>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                          {prop.address} • Listed on {new Date(prop.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleReminderAction(prop.id, "keep")}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer shadow-sm shadow-indigo-600/10"
                        >
                          Keep Active
                        </button>
                        <button
                          onClick={() => handleReminderAction(prop.id, "in_talk")}
                          className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer shadow-sm shadow-sky-500/10"
                        >
                          In Talk
                        </button>
                        <button
                          onClick={() => handleReminderAction(prop.id, "sold")}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer shadow-sm shadow-emerald-500/10"
                        >
                          Mark as Sold
                        </button>
                        <button
                          onClick={() => handleReminderAction(prop.id, "remove")}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold rounded-xl transition-all cursor-pointer border border-rose-500/20"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 p-4 rounded-2xl text-xs font-semibold border border-rose-100 dark:border-rose-900/50 mb-4 mx-4 sm:mx-0 mt-4 sm:mt-0 relative z-20">
            ⚠️ Database connection failed. Running in mock simulation mode. (Error details: {error})
          </div>
        )}
        {/* Search & Filter Control Bar */}
        <section className={`absolute top-4 left-4 right-4 z-10 sm:relative sm:top-0 sm:left-0 sm:right-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 dark:border-slate-700/50 shadow-2xl shadow-slate-900/10 mb-6 transition-all duration-500 ease-in-out ${isMobileListView ? 'hidden sm:block' : 'block'} p-4 sm:p-5 ${isMobileFiltersExpanded ? 'max-h-[85vh] overflow-y-auto' : 'max-h-[88px] overflow-hidden'}`}>
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Row 1: Search & Type */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Search Bar */}
              <div className="relative md:col-span-5 flex items-center gap-2">
                <div className="relative flex-1 flex items-center">
                  <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="sm:hidden absolute left-1 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors z-10 cursor-pointer active:scale-95"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={handleGeocodeSearch}
                    className="hidden sm:block absolute left-4 p-1.5 text-slate-400 hover:text-indigo-500 transition-colors z-10 cursor-pointer"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                  <div className="relative w-full">
                    <input
                      type="text"
                      placeholder="Search by city, neighborhood..."
                      value={searchQuery}
                      onFocus={() => {
                        setIsMobileFiltersExpanded(true);
                        setShowAutocomplete(true);
                      }}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleGeocodeSearch();
                      }}
                      className="w-full pl-12 sm:pl-12 pr-4 py-3 bg-white/40 dark:bg-black/20 border border-white/60 dark:border-white/10 rounded-full text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white/80 dark:focus:bg-black/40 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all duration-300 placeholder-slate-500 shadow-sm hover:bg-white/60 dark:hover:bg-black/30"
                    />

                    {/* Autocomplete Dropdown */}
                    {showAutocomplete && (searchQuery.trim().length > 0) && (
                      <div className="absolute top-full left-0 right-0 mt-2 z-[100] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-2xl shadow-indigo-900/10 overflow-hidden flex flex-col max-h-64 overflow-y-auto scrollbar-thin">
                        {isSearchingLocation ? (
                          <div className="p-4 flex justify-center items-center">
                            <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : autocompleteResults.length > 0 ? (
                          autocompleteResults.map((result, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectAutocomplete(result)}
                              className="flex items-start gap-3 w-full text-left p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer active:bg-slate-100"
                            >
                              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">
                                {result.display_name}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs font-medium text-slate-500">
                            No locations found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {/* Close Button for Mobile Filters */}
                {isMobileFiltersExpanded && (
                  <button 
                    onClick={() => {
                      setIsMobileFiltersExpanded(false);
                      setShowAutocomplete(false);
                    }}
                    className="sm:hidden p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all hover:scale-105 active:scale-95 shrink-0 shadow-sm"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              {/* Property Type Filter */}
              <div className={`flex gap-3 overflow-x-auto md:col-span-7 scrollbar-none items-center ${!isMobileFiltersExpanded ? 'hidden sm:flex' : 'flex'}`}>
                {[
                  { id: "ALL", label: "All", icon: "✨" },
                  { id: "HOUSE", label: "House", icon: "🏠" },
                  { id: "APARTMENT", label: "Apartment", icon: "🏢" },
                  { id: "CONDO", label: "Condo", icon: "🏬" },
                  { id: "COMMERCIAL", label: "Commercial", icon: "🏪" },
                  { id: "LAND", label: "Land", icon: "🌳" }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setPropertyType(type.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[11px] font-extrabold tracking-widest uppercase transition-all duration-300 whitespace-nowrap active:scale-[0.95] border ${
                      propertyType === type.id
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xl shadow-slate-900/20 scale-105"
                        : "bg-white/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:scale-[1.02]"
                    }`}
                  >
                    <span className="text-sm">{type.icon}</span>
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className={`h-px bg-slate-200 dark:bg-slate-800 w-full ${!isMobileFiltersExpanded ? 'hidden sm:block' : 'block'}`} />

            {/* Row 2: Geospatial Controls & Price slider */}
            <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 items-center ${!isMobileFiltersExpanded ? 'hidden sm:grid' : 'grid'}`}>
              {/* Price Range Slider */}
              <div className="lg:col-span-4 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span>Price Range</span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    Max: {formatPrice(maxPrice)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50000000"
                  step="500000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              {/* Geospatial Search Settings */}
              <div className="lg:col-span-8 flex flex-wrap gap-4 items-center justify-between lg:justify-end">
                {/* Locate User Button */}
                <button
                  onClick={handleLocateUser}
                  disabled={locating}
                  className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/50 px-4 py-2.5 rounded-2xl text-xs font-bold text-indigo-700 dark:text-indigo-300 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-sm shadow-indigo-500/5"
                >
                  <Locate className={`h-4 w-4 ${locating ? "animate-spin text-indigo-500" : "text-indigo-600 dark:text-indigo-400"}`} />
                  <span>{locating ? "Locating..." : "Use My Location"}</span>
                </button>

                {/* Viewport Bounds Filter Toggle */}
                <label className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-all select-none">
                  <input
                    type="checkbox"
                    checked={mapFilterEnabled}
                    disabled={radialSearchEnabled}
                    onChange={(e) => setMapFilterEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <span className={`text-xs font-semibold ${radialSearchEnabled ? "text-slate-400" : "text-slate-700 dark:text-slate-300"}`}>
                    Filter listings inside map view bounds
                  </span>
                </label>

                {/* Radial Search Toggle */}
                <label className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-all select-none">
                  <input
                    type="checkbox"
                    checked={radialSearchEnabled}
                    onChange={(e) => {
                      setRadialSearchEnabled(e.target.checked);
                      if (e.target.checked) setMapFilterEnabled(false);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Radius Search (PostGIS)
                  </span>
                </label>

                {radialSearchEnabled && (
                  <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/50">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                      Radius:
                    </span>
                    <select
                      value={radiusMeters}
                      onChange={(e) => setRadiusMeters(Number(e.target.value))}
                      className="bg-transparent text-xs font-bold text-indigo-800 dark:text-indigo-200 focus:outline-none cursor-pointer"
                    >
                      <option value="1000">1 km</option>
                      <option value="3000">3 km</option>
                      <option value="5000">5 km</option>
                      <option value="10000">10 km</option>
                      <option value="25000">25 km</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Split Panel Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 sm:gap-6 items-stretch flex-1 relative">
          {/* Left panel: Listing Grid */}
          <div className={`lg:col-span-7 flex flex-col gap-4 absolute inset-0 sm:relative bg-white dark:bg-slate-950 sm:bg-transparent z-20 sm:z-0 p-4 sm:p-0 overflow-y-auto sm:overflow-visible transition-transform duration-300 ${isMobileListView ? 'translate-y-0' : 'translate-y-[100%] sm:translate-y-0'}`}>
            <div className="flex justify-between items-center px-1 sticky top-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md z-10 py-2 sm:py-0">
              <h2 className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Home className="h-5 w-5 text-indigo-500" />
                Available Properties
                <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold py-1 px-2.5 rounded-full">
                  {filteredListings.length}
                </span>
              </h2>

              <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
                <ArrowUpDown className="h-3 w-3" />
                Price: High to Low
              </button>
              
              <button 
                onClick={() => setIsMobileListView(false)}
                className="flex sm:hidden items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold"
              >
                <MapPin className="h-3 w-3 text-rose-500" />
                View Map
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6">
                <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-3" />
                <p className="text-sm font-semibold text-slate-400">Scanning geospatial data...</p>
              </div>
            ) : filteredListings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-slate-800/50 rounded-[2.5rem] p-8 text-center shadow-inner">
                <MapPin className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4 animate-bounce" />
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">No properties in view</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Adjust your search keyword, clear property type filters, or drag/zoom the map to discover listings in other regions.
                </p>
                <button
                  onClick={() => {
                    setPropertyType("ALL");
                    setSearchQuery("");
                    setMaxPrice(50000000);
                    setMapFilterEnabled(false);
                    setRadialSearchEnabled(false);
                  }}
                  className="mt-5 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all hover:scale-[1.02]"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] lg:max-h-[calc(100vh-270px)] overflow-y-auto pr-1 pb-4 scrollbar-thin">
                {filteredListings.map((listing) => (
                  <div
                    key={listing.id}
                    onClick={() => handleListingClick(listing)}
                    className="group border-0 bg-transparent rounded-[2rem] overflow-hidden shadow-none hover:shadow-none transition-all duration-500 cursor-pointer flex flex-col justify-start active:scale-[0.98]"
                  >
                    {/* Image Cover */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800 rounded-[2rem] shadow-lg shadow-slate-900/5 group-hover:shadow-2xl group-hover:shadow-indigo-900/10 transition-shadow duration-500">
                      {listing.images && listing.images.length > 0 ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={getOptimizedImageUrl(listing.images[0], "q_auto,f_auto,w_400,h_300,c_fill")}
                          alt={listing.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700 bg-slate-100 dark:bg-slate-800">
                          <Building className="h-10 w-10" />
                        </div>
                      )}
                      
                      {/* Gradient Overlay for Text Readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />

                      <div className="absolute top-4 left-4 flex gap-1.5 z-10">
                        <div className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl px-3 py-1.5 rounded-full shadow-lg shadow-black/10 border border-white/20">
                          <span className="text-[10px] font-black tracking-widest uppercase text-slate-900 dark:text-white">
                            {listing.propertyType}
                          </span>
                        </div>
                        {listing.status && (
                          <div className={`backdrop-blur-xl px-2.5 py-1.5 rounded-full shadow-lg shadow-black/10 border ${
                            listing.status === "DRAFT"
                              ? "bg-amber-500/95 text-white border-amber-400/30"
                              : listing.status === "SOLD"
                              ? "bg-slate-900/95 text-white border-slate-700/50"
                              : listing.status === "IN_TALK"
                              ? "bg-sky-500/95 text-white border-sky-400/30"
                              : "bg-indigo-600/95 text-white border-indigo-400/30"
                          }`}>
                            <span className="text-[10px] font-black tracking-widest uppercase">
                              {listing.status === "ACTIVE" ? "AVAILABLE" : listing.status.replace("_", " ")}
                            </span>
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          alert("Saved to Favorites!");
                        }}
                        className="absolute top-4 right-4 p-2.5 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl rounded-full hover:bg-rose-500 hover:text-white text-slate-400 transition-all duration-300 shadow-lg shadow-black/10 active:scale-90"
                      >
                        <Heart className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Card Content Below Image */}
                    <div className="pt-4 pb-6 flex-1 flex flex-col justify-start px-2">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-black text-[16px] tracking-tight text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {listing.title}
                        </h3>
                        <div className="flex items-center gap-1 shrink-0 ml-3">
                          <span className="font-black text-[16px] tracking-tight text-slate-900 dark:text-white">
                            {formatPrice(listing.price)}
                          </span>
                        </div>
                      </div>
                      <p className="text-[14px] font-medium text-slate-500 dark:text-slate-400 line-clamp-1">
                        {listing.address}
                      </p>
                      
                      {/* Area & Price/SqFt display */}
                      {listing.areaSqft && (
                        <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400 mt-2 font-semibold">
                          <span className="flex items-center gap-1">
                            {listing.areaSqft.toLocaleString()} sq ft
                          </span>
                          <span>•</span>
                          <span>
                            ₹{Math.round(listing.price / listing.areaSqft).toLocaleString()}/sq ft
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel: Leaflet Map */}
          <div className="lg:col-span-5 absolute inset-0 sm:relative flex flex-col z-0">
            <div className="hidden sm:flex items-center justify-between mb-2 px-1">
              <h2 className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="h-5 w-5 text-rose-500" />
                Geospatial View
              </h2>
              {radialSearchEnabled && (
                <span className="text-[10px] font-extrabold tracking-wide uppercase px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 animate-pulse">
                  ST_DWithin active
                </span>
              )}
            </div>
            <div className="flex-1 sm:rounded-[2.5rem] overflow-hidden h-full sm:min-h-[400px] sm:border border-white/60 dark:border-slate-700/50 sm:shadow-2xl sm:shadow-slate-900/10 relative bg-white/50 dark:bg-slate-900/50 backdrop-blur-3xl">
              <DynamicMap
                listings={filteredListings}
                center={mapCenter}
                onBoundsChange={handleBoundsChange}
                onMarkerClick={(listing) => handleSelectListing(listing)}
              />
            </div>
            
            {/* Floating List View Toggle on Mobile Map */}
            {!isMobileListView && (
              <button
                onClick={() => setIsMobileListView(true)}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 flex sm:hidden items-center gap-2.5 bg-slate-900/95 dark:bg-white/95 backdrop-blur-xl text-white dark:text-slate-900 px-8 py-3.5 rounded-full shadow-2xl z-10 font-black tracking-wide text-sm active:scale-95 transition-all"
              >
                <Home className="h-4 w-4" />
                List View
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Selected Listing Detail Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/40 sm:bg-slate-900/60 backdrop-blur-md transition-all duration-500">
          <div className="bg-white dark:bg-slate-900 border-t sm:border border-white/20 dark:border-slate-800/50 rounded-t-[2.5rem] sm:rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-500 ease-out">
            {/* Mobile Drag Handle */}
            <div className="w-full flex sm:hidden justify-center pt-4 pb-3 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-20 rounded-t-[2.5rem]">
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Modal Image Carousel */}
            <div className="relative h-52 sm:h-60 w-full bg-slate-100 group">
              {selectedListing.images && selectedListing.images.length > 0 ? (
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
                <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700 bg-slate-100 dark:bg-slate-900">
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
                onClick={() => handleSelectListing(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/75 rounded-full text-white transition-colors cursor-pointer z-10"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="absolute bottom-4 left-4 flex gap-2 z-10">
                <div className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-sm">
                  <span className="text-xs font-extrabold tracking-wide uppercase text-indigo-700 dark:text-indigo-400">
                    {selectedListing.propertyType}
                  </span>
                </div>
                 {selectedListing.status && (
                  <div className={`backdrop-blur-md px-2.5 py-1 rounded-xl shadow-sm border ${
                    selectedListing.status === "DRAFT"
                      ? "bg-amber-500/90 text-white border-amber-400/30"
                      : selectedListing.status === "SOLD"
                      ? "bg-slate-500/90 text-white border-slate-400/30"
                      : selectedListing.status === "IN_TALK"
                      ? "bg-sky-500/90 text-white border-sky-400/30"
                      : "bg-emerald-500/90 text-white border-emerald-400/30"
                  }`}>
                    <span className="text-xs font-extrabold tracking-wide uppercase">
                      {selectedListing.status === "ACTIVE" ? "AVAILABLE" : selectedListing.status.replace("_", " ")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="flex justify-between items-start gap-4 mb-1.5">
                <h3 className="font-extrabold text-xl text-slate-900 dark:text-white leading-tight">
                  {selectedListing.title}
                </h3>
                <span className="font-extrabold text-xl text-indigo-600 dark:text-indigo-400 shrink-0">
                  {formatPrice(selectedListing.price)}
                </span>
              </div>

              {/* Area & Price/SqFt Details block */}
              {selectedListing.areaSqft && (
                <div className="flex flex-wrap items-center gap-2 mb-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
                    📐 {selectedListing.areaSqft.toLocaleString()} Sq Ft ({Math.round(selectedListing.areaSqft / 10.76391).toLocaleString()} m²)
                  </span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
                    Price/SqFt: ₹{Math.round(selectedListing.price / selectedListing.areaSqft).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-4">
                <MapPin className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="text-xs font-semibold">{selectedListing.address}</span>
              </div>

              {selectedListing.ownerId && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-4">
                  <UserIcon className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span>Seller: </span>
                  <Link
                    href={`/profile/${selectedListing.ownerId}`}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline hover:text-indigo-500 transition-colors"
                  >
                    {selectedListing.ownerName || "Anonymous Seller"}
                  </Link>
                </div>
              )}

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-4" />

              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1.5">Overview</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                {selectedListing.description}
              </p>

              {/* Geo metadata tag */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800/80 mb-6">
                <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  <span>Latitude</span>
                  <span>Longitude</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <span>{selectedListing.latitude.toFixed(6)}°</span>
                  <span>{selectedListing.longitude.toFixed(6)}°</span>
                </div>
              </div>

              {/* CTAs */}
              {session?.user?.id === selectedListing.ownerId ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleOpenEditModal(selectedListing)}
                    className="flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer font-sans"
                  >
                    Edit Listing
                  </button>
                  <button
                    onClick={() => handleDeleteListing(selectedListing.id)}
                    className="flex items-center justify-center gap-2 py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer font-sans"
                  >
                    Delete Listing
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      const phone = selectedListing.ownerPhone;
                      if (!phone) {
                        alert(`No phone number is registered for ${selectedListing.ownerName || "this agent"}.`);
                        return;
                      }
                      const displayName = selectedListing.ownerName || "the agent";
                      const confirmCall = window.confirm(`Would you like to call ${displayName} at ${phone}?`);
                      if (confirmCall) {
                        window.location.href = `tel:${phone}`;
                      }
                    }}
                    className="flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer font-sans"
                  >
                    <Phone className="h-4 w-4" />
                    Contact Agent
                  </button>
                  <button
                    onClick={() => alert("Tour booking requested! We've sent details to your email.")}
                    className="flex items-center justify-center gap-2 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer font-sans"
                  >
                    <Mail className="h-4 w-4" />
                    Schedule Tour
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Listing Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-indigo-500/5 to-violet-500/5">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-indigo-500" />
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  List Your Property
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleCreateListing} className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Property Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Modern 3 BHK Apartment in Lamphel"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                />
              </div>

              {/* Property Type & Price */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Property Type *
                  </label>
                  <select
                    value={createPropertyType}
                    onChange={(e) => setCreatePropertyType(e.target.value as PropertyType)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-sans"
                  >
                    <option value="HOUSE">House</option>
                    <option value="APARTMENT">Apartment</option>
                    <option value="CONDO">Condo</option>
                    <option value="LAND">Land</option>
                    <option value="COMMERCIAL">Commercial</option>
                  </select>
                </div>

                {/* Area & Pricing Calculator Section */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col gap-4">
                  <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📐 Area & Pricing Calculator</span>
                  </div>

                  {/* Area Input row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Total Area (Sq Ft)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 1500"
                        value={createAreaSqft}
                        onChange={(e) => handleCreateAreaSqftChange(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Total Area (Sq Meters)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 140"
                        value={createAreaSqm}
                        onChange={(e) => handleCreateAreaSqmChange(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>
                  </div>

                  {/* Price format selection and input fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Price per Sq Ft (INR)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 5000"
                        value={createPricePerSqft}
                        onChange={(e) => handleCreatePricePerSqftChange(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Total Price (INR) *
                      </label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 7500000"
                        value={createPrice}
                        onChange={(e) => handleCreatePriceChange(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans font-bold"
                      />
                    </div>
                  </div>

                  {/* Calculation Info HUD */}
                  {createAreaSqft && (createPrice || createPricePerSqft) && (
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800/40 rounded-xl p-2.5 flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span>Formula:</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                          {parseFloat(createAreaSqft).toLocaleString()} sqft × ₹{parseFloat(createPricePerSqft || "0").toLocaleString()} = ₹{parseFloat(createPrice || "0").toLocaleString()}
                        </span>
                      </div>
                      {createPrice && (
                        <div className="text-slate-400 mt-0.5">
                          💡 Desired Price Analysis: At ₹{parseFloat(createPrice).toLocaleString()} total, you are getting approx <span className="font-bold text-indigo-500">₹{parseFloat(createPricePerSqft || "0").toLocaleString()}/sq ft</span>.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>Description *</span>
                  <span className={createDescription.length >= 10 ? "text-emerald-500 font-normal lowercase text-[10px]" : "text-amber-500 font-normal lowercase text-[10px]"}>
                    (minimum 10 characters, current: {createDescription.length})
                  </span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe your property amenities, layout, and nearby attractions..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-sans"
                />
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>Address *</span>
                  <span className={createAddress.length >= 5 ? "text-emerald-500 font-normal lowercase text-[10px]" : "text-amber-500 font-normal lowercase text-[10px]"}>
                    (minimum 5 characters, current: {createAddress.length})
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lamphelpat, Imphal West, Manipur"
                  value={createAddress}
                  onChange={(e) => setCreateAddress(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                />
              </div>

              {/* Interactive Location Selection Map */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Property Location *
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    {parseFloat(createLatitude || "24.8170").toFixed(6)}°, {parseFloat(createLongitude || "93.9368").toFixed(6)}°
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mb-1 leading-snug">
                  Drag the location pin on the map below to select/adjust the property coordinates.
                </span>
                <DynamicLocationPicker
                  latitude={parseFloat(createLatitude || "24.8170")}
                  longitude={parseFloat(createLongitude || "93.9368")}
                  onChange={(lat, lng) => {
                    setCreateLatitude(lat.toString());
                    setCreateLongitude(lng.toString());
                  }}
                />
              </div>

              {/* Property Document Upload */}
              <div className="flex flex-col gap-1.5">
                <DocumentUploader
                  initialUrl={createDocumentUrl}
                  initialHash={createDocumentHash}
                  onChange={(url, hash) => {
                    setCreateDocumentUrl(url);
                    setCreateDocumentHash(hash);
                  }}
                />
              </div>

              {/* Direct Image Upload */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Property Images *
                </label>
                <ImageUploader
                  initialUrls={[]}
                  initialHashes={[]}
                  onChange={(urls, hashes) => {
                    setCreateImages(urls);
                    setCreateImageHashes(hashes);
                  }}
                  onUploadingChange={(uploading) => setCreateImagesUploading(uploading)}
                  maxFiles={5}
                />
              </div>

              {/* Custom Boundary Drawing */}
              <div className="flex flex-col gap-1.5 border border-slate-200 dark:border-slate-800/80 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/20">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Property Boundary
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Optional
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                  {createPolygonCoords.length === 0 
                    ? "No boundary polygon drawn. It will fallback to a default box boundary centered at the coordinates." 
                    : `Boundary drawn successfully (${createPolygonCoords.length} vertices, ${calculatePolygonArea(createPolygonCoords).toLocaleString(undefined, { maximumFractionDigits: 0 })} m² / ${Math.round(calculatePolygonArea(createPolygonCoords) * 10.76391).toLocaleString()} sq ft area).`}
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateBoundaryModalOpen(true)}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200/60 dark:border-slate-800/60 cursor-pointer text-center"
                >
                  {createPolygonCoords.length === 0 ? "Draw Property Boundary" : "Edit Property Boundary"}
                </button>
              </div>

              {/* Status Selection */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Listing Status *
                </span>
                <div className="grid grid-cols-4 gap-1.5 bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => setCreateStatus("ACTIVE")}
                    className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      createStatus === "ACTIVE"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Available
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateStatus("IN_TALK")}
                    className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      createStatus === "IN_TALK"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    In Talk
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateStatus("SOLD")}
                    className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      createStatus === "SOLD"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Sold
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateStatus("DRAFT")}
                    className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      createStatus === "DRAFT"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Draft
                  </button>
                </div>
              </div>

              {/* Map Sync Help text */}
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 block leading-tight">
                💡 Tip: The coordinates are pre-synchronized to the center of your active map. Drag or zoom the map behind to lock on a specific sector!
              </span>

              {/* Submit Buttons */}
              <div className="flex gap-3 mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all active:scale-[0.98] cursor-pointer font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-75 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/10 font-sans"
                >
                  {createSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Publish Listing"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Listing Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-indigo-500/5 to-violet-500/5">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-indigo-500" />
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  Edit Property Listing
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleEditListing} className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Property Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Modern 3 BHK Apartment in Lamphel"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                />
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Property Type *
                  </label>
                  <select
                    value={editPropertyType}
                    onChange={(e) => setEditPropertyType(e.target.value as PropertyType)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-sans"
                  >
                    <option value="HOUSE">House</option>
                    <option value="APARTMENT">Apartment</option>
                    <option value="CONDO">Condo</option>
                    <option value="LAND">Land</option>
                    <option value="COMMERCIAL">Commercial</option>
                  </select>
                </div>

                {/* Area & Pricing Calculator Section */}
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col gap-4">
                  <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📐 Area & Pricing Calculator</span>
                  </div>

                  {/* Area Input row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Total Area (Sq Ft)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 1500"
                        value={editAreaSqft}
                        onChange={(e) => handleEditAreaSqftChange(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Total Area (Sq Meters)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 140"
                        value={editAreaSqm}
                        onChange={(e) => handleEditAreaSqmChange(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>
                  </div>

                  {/* Price format selection and input fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Price per Sq Ft (INR)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 5000"
                        value={editPricePerSqft}
                        onChange={(e) => handleEditPricePerSqftChange(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Total Price (INR) *
                      </label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 7500000"
                        value={editPrice}
                        onChange={(e) => handleEditPriceChange(e.target.value)}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans font-bold"
                      />
                    </div>
                  </div>

                  {/* Calculation Info HUD */}
                  {editAreaSqft && (editPrice || editPricePerSqft) && (
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800/40 rounded-xl p-2.5 flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span>Formula:</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                          {parseFloat(editAreaSqft).toLocaleString()} sqft × ₹{parseFloat(editPricePerSqft || "0").toLocaleString()} = ₹{parseFloat(editPrice || "0").toLocaleString()}
                        </span>
                      </div>
                      {editPrice && (
                        <div className="text-slate-400 mt-0.5">
                          💡 Desired Price Analysis: At ₹{parseFloat(editPrice).toLocaleString()} total, you are getting approx <span className="font-bold text-indigo-500">₹{parseFloat(editPricePerSqft || "0").toLocaleString()}/sq ft</span>.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>Description *</span>
                  <span className={editDescription.length >= 10 ? "text-emerald-500 font-normal lowercase text-[10px]" : "text-amber-500 font-normal lowercase text-[10px]"}>
                    (minimum 10 characters, current: {editDescription.length})
                  </span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe your property amenities, layout, and nearby attractions..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none font-sans"
                />
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>Address *</span>
                  <span className={editAddress.length >= 5 ? "text-emerald-500 font-normal lowercase text-[10px]" : "text-amber-500 font-normal lowercase text-[10px]"}>
                    (minimum 5 characters, current: {editAddress.length})
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lamphelpat, Imphal West, Manipur"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                />
              </div>

              {/* Interactive Location Selection Map */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Property Location *
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    {parseFloat(editLatitude || "24.8170").toFixed(6)}°, {parseFloat(editLongitude || "93.9368").toFixed(6)}°
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mb-1 leading-snug">
                  Drag the location pin on the map below to select/adjust the property coordinates.
                </span>
                <DynamicLocationPicker
                  latitude={parseFloat(editLatitude || "24.8170")}
                  longitude={parseFloat(editLongitude || "93.9368")}
                  onChange={(lat, lng) => {
                    setEditLatitude(lat.toString());
                    setEditLongitude(lng.toString());
                  }}
                />
              </div>

              {/* Property Document Upload */}
              <div className="flex flex-col gap-1.5">
                <DocumentUploader
                  initialUrl={editDocumentUrl}
                  initialHash={editDocumentHash}
                  onChange={(url, hash) => {
                    setEditDocumentUrl(url);
                    setEditDocumentHash(hash);
                  }}
                />
              </div>

              {/* Direct Image Upload */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Property Images *
                </label>
                <ImageUploader
                  initialUrls={editImages}
                  initialHashes={editImageHashes}
                  onChange={(urls, hashes) => {
                    setEditImages(urls);
                    setEditImageHashes(hashes);
                  }}
                  maxFiles={5}
                />
              </div>

              {/* Custom Boundary Drawing */}
              <div className="flex flex-col gap-1.5 border border-slate-200 dark:border-slate-800/80 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/20">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Property Boundary
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Optional
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                  {editPolygonCoords.length === 0 
                    ? "No boundary polygon drawn. It will fallback to a default box boundary centered at the coordinates." 
                    : `Boundary drawn successfully (${editPolygonCoords.length} vertices, ${calculatePolygonArea(editPolygonCoords).toLocaleString(undefined, { maximumFractionDigits: 0 })} m² / ${Math.round(calculatePolygonArea(editPolygonCoords) * 10.76391).toLocaleString()} sq ft area).`}
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditBoundaryModalOpen(true)}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200/60 dark:border-slate-800/60 cursor-pointer text-center"
                >
                  {editPolygonCoords.length === 0 ? "Draw Property Boundary" : "Edit Property Boundary"}
                </button>
              </div>

              {/* Status Selection */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Listing Status *
                </span>
                <div className="grid grid-cols-4 gap-1.5 bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => setEditStatus("ACTIVE")}
                    className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      editStatus === "ACTIVE"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Available
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus("IN_TALK")}
                    className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      editStatus === "IN_TALK"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    In Talk
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus("SOLD")}
                    className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      editStatus === "SOLD"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Sold
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus("DRAFT")}
                    className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      editStatus === "DRAFT"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Draft
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all active:scale-[0.98] cursor-pointer font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-75 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/10 font-sans"
                >
                  {editSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Create Boundary Drawing Modal Dialog */}
      {isCreateBoundaryModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Draw Property Boundary
                </h3>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Trace the exact footprint of your listing
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateBoundaryModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-850 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Modal Body (Map Canvas) */}
            <div className="flex-1 min-h-0 relative">
              <DynamicBoundaryEditor
                value={createPolygonCoords}
                onChange={setCreatePolygonCoords}
                center={[parseFloat(createLatitude), parseFloat(createLongitude)]}
              />
            </div>
            
            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-955">
              <button
                type="button"
                onClick={() => {
                  setCreatePolygonCoords([]);
                  setIsCreateBoundaryModalOpen(false);
                }}
                className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-2xl text-xs font-bold transition-all cursor-pointer"
              >
                Clear Boundary
              </button>
              <button
                type="button"
                disabled={createPolygonCoords.length > 0 && !validatePolygon(createPolygonCoords).isValid}
                onClick={() => setIsCreateBoundaryModalOpen(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Confirm Boundary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Edit Boundary Drawing Modal Dialog */}
      {isEditBoundaryModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Edit Property Boundary
                </h3>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Update the spatial boundary for this property
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditBoundaryModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-850 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Modal Body (Map Canvas) */}
            <div className="flex-1 min-h-0 relative">
              <DynamicBoundaryEditor
                value={editPolygonCoords}
                onChange={setEditPolygonCoords}
                center={[parseFloat(editLatitude) || 24.8170, parseFloat(editLongitude) || 93.9368]}
              />
            </div>
            
            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-955">
              <button
                type="button"
                onClick={() => {
                  setEditPolygonCoords([]);
                  setIsEditBoundaryModalOpen(false);
                }}
                className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-2xl text-xs font-bold transition-all cursor-pointer"
              >
                Clear Boundary
              </button>
              <button
                type="button"
                disabled={editPolygonCoords.length > 0 && !validatePolygon(editPolygonCoords).isValid}
                onClick={() => setIsEditBoundaryModalOpen(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Confirm Boundary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
