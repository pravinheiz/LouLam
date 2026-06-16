"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  PenTool,
  Move,
  Trash2,
  Eye,
  Check,
  RotateCcw,
  Maximize,
  HelpCircle,
  AlertTriangle,
  Layers,
  Compass,
  Locate
} from "lucide-react";
import { validatePolygon, calculatePolygonArea, calculatePolygonPerimeter } from "@/lib/polygon-utils";

// Override Leaflet's default marker icon configuration to prevent bundle breakage
if (typeof window !== "undefined") {
  // @ts-expect-error - Overriding default leaflet internal method
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
}

// Generate premium circular handles for coordinates
const createVertexIcon = (index: number, mode: string, isStarting: boolean = false) => {
  let colorClass = "bg-indigo-600 hover:bg-indigo-500 border-white";
  if (isStarting && mode === "draw") {
    colorClass = "bg-emerald-500 border-white shadow-[0_0_10px_#10b981] animate-pulse";
  } else if (mode === "delete") {
    colorClass = "bg-rose-500 hover:bg-rose-600 border-white";
  }

  return L.divIcon({
    className: "",
    html: `<div class="w-4 h-4 rounded-full border-2 ${colorClass} flex items-center justify-center text-[9px] font-black text-white cursor-pointer select-none shadow-md transition-all">${index + 1}</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

interface BoundaryMapEditorProps {
  value: [number, number][];
  onChange: (coordinates: [number, number][]) => void;
  center?: [number, number];
  zoom?: number;
  readOnly?: boolean;
}

// Sub-component to sync map view center/bounds
function ChangeMapView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

// Sub-component to fit map bounds to existing polygon
function ZoomToPolygon({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  const hasZoomedRef = useRef(false);

  useEffect(() => {
    // Only zoom to fit ONCE on mount if initial coordinates are present
    if (coords.length > 0 && !hasZoomedRef.current) {
      hasZoomedRef.current = true;
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [coords, map]);

  return null;
}

// Sub-component to handle map clicks for coordinate additions in draw mode
function MapClickHandler({
  activeMode,
  onMapClick,
}: {
  activeMode: string;
  onMapClick: (latlng: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (activeMode === "draw") {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

// Sub-component to track mouse movement for guide line render in draw mode
function MapMouseTrackHandler({
  activeMode,
  lastCoord,
  onHoverCoord,
}: {
  activeMode: string;
  lastCoord: [number, number] | null;
  onHoverCoord: (latlng: [number, number] | null) => void;
}) {
  const map = useMap();
  
  useEffect(() => {
    if (activeMode !== "draw" || !lastCoord) {
      onHoverCoord(null);
      return;
    }
    
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      onHoverCoord([e.latlng.lat, e.latlng.lng]);
    };
    
    map.on("mousemove", handleMouseMove);
    return () => {
      map.off("mousemove", handleMouseMove);
    };
  }, [activeMode, lastCoord, map, onHoverCoord]);
  
  return null;
}

export default function BoundaryMapEditor({
  value = [],
  onChange,
  center = [24.8170, 93.9368], // Imphal, Manipur defaults
  zoom = 14,
  readOnly = false,
}: BoundaryMapEditorProps) {
  const [mode, setMode] = useState<"view" | "draw" | "edit" | "delete">(
    readOnly ? "view" : value.length === 0 ? "draw" : "view"
  );
  const [hoverCoord, setHoverCoord] = useState<[number, number] | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [mapType, setMapType] = useState<"satellite" | "terrain" | "hybrid" | "roadmap">("satellite");
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<[number, number] | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const toggleGps = () => {
    if (gpsActive) {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      setGpsActive(false);
      setGpsCoords(null);
    } else {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
      }
      setGpsActive(true);
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setGpsCoords([latitude, longitude]);
          if (mapInstance) {
            mapInstance.setView([latitude, longitude], 17);
          }
        },
        (error) => {
          console.error("GPS error:", error);
          alert("GPS Location Error: " + error.message);
          setGpsActive(false);
        },
        { enableHighAccuracy: true }
      );
      setWatchId(id);
    }
  };

  // Validation details
  const validation = validatePolygon(value);
  const area = calculatePolygonArea(value);
  const perimeter = calculatePolygonPerimeter(value);

  // Undo last vertex addition
  const handleUndo = useCallback(() => {
    if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }, [value, onChange]);

  // Clear polygon completely
  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear the entire boundary polygon?")) {
      onChange([]);
      setMode("draw");
    }
  };

  // Click handler on map
  const handleMapClick = (latlng: L.LatLng) => {
    onChange([...value, [latlng.lat, latlng.lng]]);
  };

  // Drag handler on vertex marker
  const handleVertexDrag = (index: number, e: L.DragEndEvent) => {
    const marker = e.target;
    const position = marker.getLatLng();
    const newCoords = [...value];
    newCoords[index] = [position.lat, position.lng];
    onChange(newCoords);
  };

  // Click handler on vertex marker
  const handleVertexClick = (index: number) => {
    if (mode === "delete") {
      const newCoords = value.filter((_, idx) => idx !== index);
      onChange(newCoords);
    } else if (mode === "draw" && index === 0 && value.length >= 3) {
      // Clicked the starting coordinate -> Close loop and transition mode
      setMode("view");
      setHoverCoord(null);
    }
  };

  // Zoom map to fit polygon bounds
  const handleZoomToFit = () => {
    if (mapInstance && value.length > 0) {
      const bounds = L.latLngBounds(value);
      mapInstance.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  // Capture global Escape / Backspace keys
  useEffect(() => {
    if (readOnly) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMode("view");
        setHoverCoord(null);
      } else if (e.key === "Backspace" && mode === "draw") {
        handleUndo();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mode, readOnly, handleUndo]);

  const lastCoord = value.length > 0 ? value[value.length - 1] : null;

  // Generate midpoint markers for adding new vertices by dragging edges
  const renderMidpointHandles = () => {
    if (mode !== "edit" || value.length < 2) return null;

    return value.map((coord, index) => {
      const nextIndex = (index + 1) % value.length;
      const nextCoord = value[nextIndex];
      
      // Calculate midpoint
      const midLat = (coord[0] + nextCoord[0]) / 2;
      const midLng = (coord[1] + nextCoord[1]) / 2;
      const midPosition: [number, number] = [midLat, midLng];

      // Circular small semi-transparent handle icon
      const midpointIcon = L.divIcon({
        className: "",
        html: `<div class="w-3 h-3 rounded-full border border-dashed border-white bg-indigo-400/80 hover:bg-indigo-500 cursor-pointer shadow-sm transition-all hover:scale-125"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const handleMidpointDragEnd = (e: L.DragEndEvent) => {
        const marker = e.target;
        const position = marker.getLatLng();
        
        // Insert new coordinate between index and nextIndex
        const newCoords = [...value];
        newCoords.splice(index + 1, 0, [position.lat, position.lng]);
        onChange(newCoords);
      };

      return (
        <Marker
          key={`mid-${index}-${midLat}-${midLng}`}
          position={midPosition}
          icon={midpointIcon}
          draggable={true}
          eventHandlers={{
            dragend: handleMidpointDragEnd,
          }}
        />
      );
    });
  };

  return (
    <div className="w-full h-full flex flex-col font-sans border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-950 relative shadow-inner">
      {/* Upper Toolbar Panel (Visible only when not readOnly) */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shadow-sm">
          {/* Action Modes Selector */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
            <button
              type="button"
              onClick={() => {
                setMode("view");
                setHoverCoord(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === "view"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              title="View Boundary Mode"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>View</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("draw");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === "draw"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              title="Draw Boundary Mode"
            >
              <PenTool className="h-3.5 w-3.5" />
              <span>Draw</span>
            </button>
            <button
              type="button"
              disabled={value.length === 0}
              onClick={() => {
                setMode("edit");
                setHoverCoord(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                mode === "edit"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              title="Edit Vertices Mode"
            >
              <Move className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              disabled={value.length === 0}
              onClick={() => {
                setMode("delete");
                setHoverCoord(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                mode === "delete"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              title="Delete Nodes Mode"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          </div>
 
          {/* Quick Actions (Undo, Clear, Complete, Fit) */}
          <div className="flex items-center gap-2">
            {mode === "draw" && value.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleUndo}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-200/50 dark:border-slate-800/50 cursor-pointer"
                  title="Undo Last Node (Backspace)"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Undo</span>
                </button>
                {value.length >= 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("view");
                      setHoverCoord(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                    title="Complete Boundary"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Complete</span>
                  </button>
                )}
              </>
            )}
            
            {value.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleZoomToFit}
                  className="flex items-center justify-center p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200/50 dark:border-slate-800/50 cursor-pointer"
                  title="Zoom to Fit boundary"
                >
                  <Maximize className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="Reset Boundary"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Clear All</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
 
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

      {/* GPS Geolocation Locator Floating Control */}
      <div className="absolute top-4 left-4 z-[400] flex gap-2">
        <button
          type="button"
          onClick={toggleGps}
          className={`flex items-center gap-1.5 px-3 py-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl text-xs font-bold transition-all cursor-pointer ${
            gpsActive
              ? "text-sky-500 border-sky-500/50 bg-sky-500/5"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-800"
          }`}
          title={gpsActive ? "Stop GPS Tracking" : "Start GPS Tracking"}
        >
          <Compass className={`h-3.5 w-3.5 ${gpsActive ? "animate-spin" : ""}`} />
          <span>{gpsActive ? "GPS Active" : "Track GPS"}</span>
        </button>
        {gpsActive && gpsCoords && mode === "draw" && (
          <button
            key="add-gps-point-btn"
            type="button"
            onClick={() => {
              onChange([...value, gpsCoords]);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xl text-xs font-bold transition-all cursor-pointer"
            title="Add your current GPS coordinates as a boundary vertex"
          >
            <Locate className="h-3.5 w-3.5" />
            <span>Add Point</span>
          </button>
        )}
      </div>

      {/* Main Map Box */}
      <div className="flex-1 relative min-h-[300px] z-10">
        <MapContainer
          center={center}
          zoom={zoom}
          className="w-full h-full"
          ref={setMapInstance}
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
          {value.length > 0 && <ZoomToPolygon coords={value} />}
 
          {/* Interactive Mouse Event Listeners */}
          {!readOnly && (
            <>
              <MapClickHandler activeMode={mode} onMapClick={handleMapClick} />
              <MapMouseTrackHandler
                activeMode={mode}
                lastCoord={lastCoord}
                onHoverCoord={setHoverCoord}
              />
            </>
          )}
 
          {/* 1. Closed Polygon Render (Mode is not Draw) */}
          {mode !== "draw" && value.length >= 3 && (
            <Polygon
              positions={value}
              pathOptions={{
                color: validation.isValid ? "#4f46e5" : "#f43f5e",
                fillColor: validation.isValid ? "#6366f1" : "#f43f5e",
                fillOpacity: 0.15,
                weight: 3,
              }}
            />
          )}
 
          {/* 2. Open Polyline Render (Mode is Draw) */}
          {mode === "draw" && value.length > 0 && (
            <Polyline
              positions={value}
              pathOptions={{
                color: "#6366f1",
                weight: 3,
                dashArray: "6, 6",
              }}
            />
          )}
 
          {/* 3. Dotted Guide Line (From last vertex to hover cursor) */}
          {mode === "draw" && lastCoord && hoverCoord && (
            <Polyline
              positions={[lastCoord, hoverCoord]}
              pathOptions={{
                color: "#818cf8",
                weight: 2,
                dashArray: "3, 6",
              }}
            />
          )}
 
          {/* 4. Vertex Markers with Circular handles */}
          {!readOnly && (mode === "draw" || mode === "edit" || mode === "delete") &&
            value.map((coord, index) => (
              <Marker
                key={`vertex-${index}`}
                position={coord}
                icon={createVertexIcon(index, mode, index === 0)}
                draggable={mode === "edit"}
                eventHandlers={{
                  dragend: (e) => handleVertexDrag(index, e),
                  click: () => handleVertexClick(index),
                }}
              />
            ))}

          {/* 5. Midpoint Draggable handles to insert nodes on dragging edges */}
          {!readOnly && renderMidpointHandles()}

          {/* 6. Geolocation Current User GPS Marker */}
          {gpsActive && gpsCoords && (
            <Marker
              position={gpsCoords}
              icon={L.divIcon({
                className: "gps-pulse-marker",
                html: `
                  <div class="relative flex items-center justify-center">
                    <div class="absolute w-8 h-8 bg-sky-500/30 rounded-full animate-ping"></div>
                    <div class="relative w-4 h-4 bg-sky-500 border-2 border-white rounded-full shadow-lg"></div>
                  </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              })}
            />
          )}
        </MapContainer>

        {/* Floating Mode HUD Indicator */}
        {!readOnly && (
          <div className="absolute top-16 left-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg z-30 pointer-events-none flex flex-col gap-0.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Active Mode
            </div>
            <div className="text-sm font-extrabold text-slate-800 dark:text-white capitalize flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${
                mode === "draw" 
                  ? "bg-emerald-500 animate-ping" 
                  : mode === "edit" 
                    ? "bg-amber-500" 
                    : mode === "delete" 
                      ? "bg-rose-500" 
                      : "bg-indigo-600"
              }`} />
              {mode === "draw" ? "Drawing Boundary" : mode === "edit" ? "Editing Vertices" : mode === "delete" ? "Deleting Nodes" : "Viewing Boundary"}
            </div>
          </div>
        )}

        {/* Help Tip Overlay (Only visible in draw mode) */}
        {!readOnly && mode === "draw" && (
          <div className="absolute bottom-4 left-4 bg-slate-900/95 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-800/80 text-white shadow-xl z-30 max-w-xs text-xs pointer-events-none animate-in slide-in-from-bottom-5">
            <div className="flex gap-2 items-start">
              <HelpCircle className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">Drawing Guide:</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-300 font-medium">
                  <li>Click map to add boundary points.</li>
                  <li>Click starting point (1) to close shape.</li>
                  <li>Press <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px]">Backspace</kbd> to delete last point.</li>
                  <li>Press <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px]">Esc</kbd> to exit.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Metrics & Validations Stats Panel */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 z-20 shadow-md">
        {/* Polygon Metrics */}
        <div className="grid grid-cols-3 gap-6 font-sans">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Vertices
            </div>
            <div className="text-sm font-extrabold text-slate-800 dark:text-white mt-0.5">
              {value.length} Nodes
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Area
            </div>
            <div className="text-sm font-extrabold text-slate-800 dark:text-white mt-0.5">
              {area > 1000000 
                ? `${(area / 1000000).toFixed(3)} km²` 
                : `${area.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²`}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Perimeter
            </div>
            <div className="text-sm font-extrabold text-slate-800 dark:text-white mt-0.5">
              {perimeter > 1000 
                ? `${(perimeter / 1000).toFixed(2)} km` 
                : `${perimeter.toLocaleString(undefined, { maximumFractionDigits: 1 })} m`}
            </div>
          </div>
        </div>

        {/* Validation Status */}
        {value.length > 0 && (
          <div className="flex items-center gap-2">
            {validation.isValid ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <Check className="h-3.5 w-3.5" />
                <span>Valid Boundary Geometry</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-[200px]" title={validation.errors[0]}>
                  {validation.errors[0]}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
