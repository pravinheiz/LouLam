"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import { Layers } from "lucide-react";

interface PolygonGeoJSON {
  type: "Polygon";
  coordinates: number[][][];
}

interface NearbyListing {
  id: string;
  title: string;
  price: number;
  address: string;
  latitude: number;
  longitude: number;
  propertyType: string;
}

interface PropertyDetailsMapProps {
  latitude: number;
  longitude: number;
  polygon: PolygonGeoJSON | null;
  nearbyListings: NearbyListing[];
  title: string;
  price: number;
}

// Convert GeoJSON polygon coordinates [lng, lat] to Leaflet [lat, lng]
const convertGeoJSONPolygonToLeaflet = (polygonGeoJSON: PolygonGeoJSON | null | undefined): [number, number][] => {
  if (!polygonGeoJSON || polygonGeoJSON.type !== "Polygon") return [];
  const coordinates = polygonGeoJSON.coordinates[0];
  return coordinates.map((coord: number[]) => [coord[1], coord[0]]);
};

// Sub-component to monitor map center changes
function ChangeMapView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [center, map]);
  return null;
}

export default function PropertyDetailsMap({
  latitude,
  longitude,
  polygon,
  nearbyListings,
  title,
  price,
}: PropertyDetailsMapProps) {
  const [mapType, setMapType] = useState<"satellite" | "terrain" | "hybrid" | "roadmap">("satellite");

  // Format price helper
  const formatPrice = (p: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(p);
  };

  const center: [number, number] = [latitude, longitude];
  const leafletPolygon = polygon ? convertGeoJSONPolygonToLeaflet(polygon) : [];

  // Generate modern markers using HTML/Tailwind to match high-end design
  const createActiveIcon = () => {
    if (typeof window === "undefined") return undefined;
    return L.divIcon({
      className: "custom-active-marker",
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-8 h-8 bg-indigo-500/30 rounded-full animate-ping"></div>
          <div class="relative w-8 h-8 bg-indigo-600 border-2 border-white rounded-full flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const createSuggestionIcon = () => {
    if (typeof window === "undefined") return undefined;
    return L.divIcon({
      className: "custom-suggestion-marker",
      html: `
        <div class="w-6 h-6 bg-slate-500 hover:bg-emerald-500 border border-white rounded-full flex items-center justify-center shadow-md transition-colors duration-300">
          <div class="w-2 h-2 bg-white rounded-full"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800 z-10 relative">
      {/* Map Layer Switcher Floating Control */}
      <div className="absolute top-4 right-4 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-2.5 rounded-2xl shadow-xl flex flex-col gap-1.5 min-w-[110px]">
        <div className="flex items-center gap-1.5 px-1 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <Layers className="h-3.5 w-3.5 text-indigo-500" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Map Style</span>
        </div>
        {(["roadmap", "satellite", "terrain", "hybrid"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setMapType(type)}
            className={`w-full text-left px-2.5 py-0.5 text-[10px] font-bold rounded-lg uppercase tracking-wide transition-all cursor-pointer ${
              mapType === type
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <MapContainer
        center={center}
        zoom={15}
        className="w-full h-full"
        style={{ minHeight: "380px" }}
      >
        <TileLayer
          attribution='&copy; Google'
          url={
            mapType === "satellite"
              ? "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              : mapType === "terrain"
              ? "https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
              : mapType === "hybrid"
              ? "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              : "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          }
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          maxZoom={20}
        />

        <ChangeMapView center={center} />

        {/* Boundary Polygon Visualization */}
        {leafletPolygon.length > 0 && (
          <Polygon
            positions={leafletPolygon}
            pathOptions={{
              color: "#4f46e5",
              fillColor: "#818cf8",
              fillOpacity: 0.15,
              weight: 3,
              dashArray: "6, 8",
            }}
          />
        )}

        {/* Main Property Active Pin */}
        <Marker position={center} icon={createActiveIcon()}>
          <Popup className="custom-popup">
            <div className="p-1.5 font-sans">
              <span className="inline-block px-2 py-0.5 mb-1 text-[9px] font-bold tracking-wider text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-300 rounded uppercase">
                Active Listing
              </span>
              <h4 className="font-extrabold text-slate-900 text-sm leading-tight line-clamp-1">
                {title}
              </h4>
              <p className="font-extrabold text-indigo-600 text-sm mt-1">
                {formatPrice(price)}
              </p>
            </div>
          </Popup>
        </Marker>

        {/* Nearby Listing Pins */}
        {nearbyListings
          .filter((item) => item.id !== undefined && (item.latitude !== latitude || item.longitude !== longitude))
          .map((item) => (
            <Marker
              key={item.id}
              position={[item.latitude, item.longitude]}
              icon={createSuggestionIcon()}
            >
              <Popup className="custom-popup">
                <div className="p-1.5 font-sans w-48">
                  <span className="inline-block px-2 py-0.5 mb-1 text-[9px] font-bold tracking-wider text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 rounded uppercase">
                    {item.propertyType.toLowerCase()}
                  </span>
                  <h4 className="font-bold text-slate-950 text-xs leading-tight line-clamp-1">
                    {item.title}
                  </h4>
                  <p className="font-extrabold text-emerald-600 text-xs mt-1">
                    {formatPrice(item.price)}
                  </p>
                  <div className="mt-2.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <Link
                      href={`/listings/${item.id}`}
                      className="inline-block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      View Details &rarr;
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
