"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Layers } from "lucide-react";

// Fix Leaflet's default marker icon paths which break under Next.js bundler
if (typeof window !== "undefined") {
  // @ts-expect-error - overriding default leaflet internal method
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

interface PolygonGeoJSON {
  type: "Polygon";
  coordinates: number[][][];
}

interface ListingPin {
  id: string;
  title: string;
  price: number;
  latitude: number;
  longitude: number;
  propertyType: string;
  address: string;
  polygon?: PolygonGeoJSON | null;
}

// Convert GeoJSON polygon coordinates [lng, lat] to Leaflet [lat, lng]
const convertGeoJSONPolygonToLeaflet = (polygonGeoJSON: PolygonGeoJSON | null | undefined): [number, number][] => {
  if (!polygonGeoJSON || polygonGeoJSON.type !== "Polygon") return [];
  const coordinates = polygonGeoJSON.coordinates[0];
  return coordinates.map((coord: number[]) => [coord[1], coord[0]]);
};

interface MapProps {
  listings: ListingPin[];
  center: [number, number];
  zoom?: number;
  onBoundsChange?: (bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  }) => void;
}

// Sub-component to monitor map center/zoom and update container
function ChangeMapView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    const currentCenter = map.getCenter();
    const latDiff = Math.abs(currentCenter.lat - center[0]);
    const lngDiff = Math.abs(currentCenter.lng - center[1]);
    const currentZoom = map.getZoom();
    
    // Only call setView if the coordinates or zoom are significantly different
    if (latDiff > 0.0001 || lngDiff > 0.0001 || currentZoom !== zoom) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

// Sub-component to handle map drag/zoom movements and emit map bounds
function MapEventsHandler({
  onBoundsChange,
}: {
  onBoundsChange?: (bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  }) => void;
}) {
  const map = useMap();

  const triggerBoundsChange = useCallback(() => {
    if (!onBoundsChange) return;
    const bounds = map.getBounds();
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();

    onBoundsChange({
      south: southWest.lat,
      west: southWest.lng,
      north: northEast.lat,
      east: northEast.lng,
    });
  }, [map, onBoundsChange]);

  useMapEvents({
    moveend: () => {
      triggerBoundsChange();
    },
    zoomend: () => {
      triggerBoundsChange();
    },
  });

  // Initial load trigger
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      // Small timeout to let leaflet map finalize rendering
      const timer = setTimeout(() => {
        triggerBoundsChange();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [triggerBoundsChange]);

  return null;
}

export default function LeafletMap({
  listings,
  center,
  zoom = 13,
  onBoundsChange,
}: MapProps) {
  const [mapType, setMapType] = useState<"satellite" | "terrain" | "hybrid" | "roadmap">("hybrid");

  // Formatter for currency
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 z-10 relative">
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
        zoom={zoom}
        className="w-full h-full"
        style={{ minHeight: "350px" }}
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
        
        <ChangeMapView center={center} zoom={zoom} />
        
        {onBoundsChange && <MapEventsHandler onBoundsChange={onBoundsChange} />}

        {listings.map((listing) => {
          const leafletPolygon = listing.polygon ? convertGeoJSONPolygonToLeaflet(listing.polygon) : [];

          return (
            <div key={listing.id}>
              {leafletPolygon.length > 0 && (
                <Polygon
                  positions={leafletPolygon}
                  pathOptions={{
                    color: "#4f46e5",
                    fillColor: "#818cf8",
                    fillOpacity: 0.12,
                    weight: 2.5,
                    dashArray: "4, 6",
                  }}
                />
              )}
              <Marker
                position={[listing.latitude, listing.longitude]}
              >
                <Popup className="custom-popup">
                  <div className="p-1 font-sans">
                    <span className="inline-block px-2 py-0.5 mb-1 text-[10px] font-semibold tracking-wider text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-300 rounded uppercase">
                      {listing.propertyType.toLowerCase()}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight line-clamp-1">
                      {listing.title}
                    </h4>
                    <p className="text-xs text-slate-500 mb-1 line-clamp-1">{listing.address}</p>
                    <p className="font-extrabold text-indigo-600 text-sm">
                      {formatPrice(listing.price)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}
