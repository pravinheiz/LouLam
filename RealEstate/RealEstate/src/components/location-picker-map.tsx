import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Layers } from "lucide-react";

// Override Leaflet's default marker icon paths which break under Next.js bundling
if (typeof window !== "undefined") {
  // @ts-expect-error - overriding default leaflet internal method
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
}

// Sub-component to sync map view center when coordinate values change externally
function SyncMapCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function LocationPickerMap({
  latitude,
  longitude,
  onChange,
}: LocationPickerMapProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const [mapType, setMapType] = useState<"satellite" | "terrain" | "hybrid" | "roadmap">("hybrid");

  const eventHandlers = React.useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const position = marker.getLatLng();
          onChange(position.lat, position.lng);
        }
      },
    }),
    [onChange]
  );

  return (
    <div className="w-full h-96 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 z-10 relative">
      {/* Map Layer Switcher Floating Control */}
      <div className="absolute top-4 right-4 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-2 rounded-xl shadow-xl flex flex-col gap-1 min-w-[95px]">
        <div className="flex items-center gap-1 px-1 pb-1 border-b border-slate-100 dark:border-slate-800">
          <Layers className="h-3 w-3 text-indigo-500" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Map Style</span>
        </div>
        {(["roadmap", "satellite", "terrain", "hybrid"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setMapType(type)}
            className={`w-full text-left px-2 py-0.5 text-[9px] font-bold rounded-lg uppercase tracking-wide transition-all cursor-pointer ${
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
        center={[latitude, longitude]}
        zoom={14}
        className="w-full h-full"
        style={{ minHeight: "360px" }}
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
        
        <SyncMapCenter lat={latitude} lng={longitude} />
        
        <Marker
          draggable={true}
          eventHandlers={eventHandlers}
          position={[latitude, longitude]}
          ref={markerRef}
        />
      </MapContainer>
    </div>
  );
}
