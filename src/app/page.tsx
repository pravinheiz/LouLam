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
  AlertTriangle
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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
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
        const { latitude, longitude } = position.coords;
        setMapCenter([latitude, longitude]);
        setRadialSearchEnabled(true);
        setMapFilterEnabled(false);
        setLocating(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert("Unable to retrieve location. Please check browser permissions.");
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
  }, []);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-50 font-sans">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 transition-colors">
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
                  className="hidden sm:flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
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
                  className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-slate-700 dark:text-slate-200"
                >
                  <LogIn className="h-4 w-4 text-slate-400" />
                  <span>Log In</span>
                </Link>

                <Link
                  href="/register"
                  className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Register</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {expiredListings.length > 0 && (
          <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6 mb-6">
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
          <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 p-4 rounded-2xl text-xs font-semibold border border-rose-100 dark:border-rose-900/50 mb-4">
            ⚠️ Database connection failed. Running in mock simulation mode. (Error details: {error})
          </div>
        )}
        {/* Search & Filter Control Bar */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 transition-colors">
          <div className="flex flex-col gap-6">
            {/* Row 1: Search & Type */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Search Bar */}
              <div className="relative md:col-span-5">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by city, neighborhood, zip code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-slate-400"
                />
              </div>

              {/* Property Type Filter */}
              <div className="flex gap-2 overflow-x-auto pb-1 md:col-span-7 scrollbar-thin">
                {["ALL", "HOUSE", "APARTMENT", "CONDO", "COMMERCIAL", "LAND"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setPropertyType(type)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold tracking-wide uppercase transition-all whitespace-nowrap ${
                      propertyType === type
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                        : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-200 dark:bg-slate-800 w-full" />

            {/* Row 2: Geospatial Controls & Price slider */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left panel: Listing Grid */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex justify-between items-center px-1">
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
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6">
                <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mb-3" />
                <p className="text-sm font-semibold text-slate-400">Scanning geospatial data...</p>
              </div>
            ) : filteredListings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center">
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
                    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
                  >
                    {/* Image Cover */}
                    <div className="relative h-44 overflow-hidden bg-slate-100 dark:bg-slate-800">
                      {listing.images && listing.images.length > 0 ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={getOptimizedImageUrl(listing.images[0], "q_auto,f_auto,w_400,h_300,c_fill")}
                          alt={listing.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700 bg-slate-100 dark:bg-slate-800">
                          <Building className="h-10 w-10" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                        <div className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-sm">
                          <span className="text-[10px] font-extrabold tracking-wide uppercase text-indigo-700 dark:text-indigo-400">
                            {listing.propertyType}
                          </span>
                        </div>
                        {listing.status && (
                          <div className={`backdrop-blur-md px-2 py-0.5 rounded-xl shadow-sm border ${
                            listing.status === "DRAFT"
                              ? "bg-amber-500/90 text-white border-amber-400/30"
                              : listing.status === "SOLD"
                              ? "bg-slate-500/90 text-white border-slate-400/30"
                              : listing.status === "IN_TALK"
                              ? "bg-sky-500/90 text-white border-sky-400/30"
                              : "bg-emerald-500/90 text-white border-emerald-400/30"
                          }`}>
                            <span className="text-[9px] font-extrabold tracking-wide uppercase">
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
                        className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md rounded-xl hover:bg-white dark:hover:bg-slate-950 text-slate-400 hover:text-rose-500 transition-colors shadow-sm"
                      >
                        <Heart className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-1.5">
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {listing.title}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 leading-relaxed">
                          {listing.description}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 mb-2">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                          <span className="text-[11px] font-medium line-clamp-1">
                            {listing.address}
                          </span>
                        </div>

                        {/* Area & Price/SqFt display */}
                        {listing.areaSqft && (
                          <div className="flex items-center gap-3 text-[11.5px] text-slate-500 dark:text-slate-400 mb-3 font-bold">
                            <span className="bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                              📐 {listing.areaSqft.toLocaleString()} sq ft
                            </span>
                            <span className="text-indigo-600 dark:text-indigo-400">
                              ₹{Math.round(listing.price / listing.areaSqft).toLocaleString()}/sq ft
                            </span>
                          </div>
                        )}

                        {/* Price & Action */}
                        <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 dark:border-slate-800">
                          <span className="font-extrabold text-base text-indigo-600 dark:text-indigo-400">
                            {formatPrice(listing.price)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectListing(listing);
                            }}
                            className="bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel: Leaflet Map */}
          <div className="lg:col-span-5 min-h-[400px] lg:min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-2 px-1">
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
            <div className="flex-1 rounded-3xl overflow-hidden min-h-[400px] border border-slate-200 dark:border-slate-800 shadow-sm relative">
              <DynamicMap
                listings={filteredListings}
                center={mapCenter}
                onBoundsChange={handleBoundsChange}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Selected Listing Detail Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Image Carousel */}
            <div className="relative h-60 w-full bg-slate-100 group">
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
