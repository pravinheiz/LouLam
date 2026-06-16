"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Home,
  Copy,
  Check,
  Upload,
  Download,
  AlertTriangle,
  Info,
  Trash2,
  Plus
} from "lucide-react";
import { DynamicBoundaryEditor } from "@/components/dynamic-boundary-editor";
import {
  validatePolygon,
  calculatePolygonArea,
  calculatePolygonPerimeter,
  coordinatesToGeoJson,
  geoJsonToCoordinates
} from "@/lib/polygon-utils";

// Seed coordinates near Imphal East
const initialMockCoords: [number, number][] = [
  [24.8436, 93.9450],
  [24.8456, 93.9480],
  [24.8420, 93.9490],
  [24.8400, 93.9460]
];

export default function BoundaryDesignerPage() {
  const [coords, setCoords] = useState<[number, number][]>(initialMockCoords);
  const [geoJsonText, setGeoJsonText] = useState(() => 
    coordinatesToGeoJson(initialMockCoords, { name: "Boundary Designer Shape" })
  );
  const [copied, setCopied] = useState(false);
  const [geojsonError, setGeojsonError] = useState<string | null>(null);
  
  // Manual vertex inputs
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");

  // Helper to synchronize both states without a useEffect
  const updateCoords = (newCoords: [number, number][]) => {
    setCoords(newCoords);
    if (newCoords.length > 0) {
      setGeoJsonText(coordinatesToGeoJson(newCoords, { name: "Boundary Designer Shape" }));
    } else {
      setGeoJsonText("");
    }
  };

  const validation = validatePolygon(coords);
  const area = calculatePolygonArea(coords);
  const perimeter = calculatePolygonPerimeter(coords);

  // Copy GeoJSON to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(geoJsonText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  // Import pasted GeoJSON
  const handleImportGeoJson = () => {
    try {
      setGeojsonError(null);
      if (!geoJsonText.trim()) {
        setGeojsonError("Please paste a GeoJSON string first.");
        return;
      }
      
      const parsedCoords = geoJsonToCoordinates(geoJsonText);
      if (parsedCoords.length === 0) {
        throw new Error("Parsed GeoJSON coordinates array is empty");
      }
      
      const checkVal = validatePolygon(parsedCoords);
      if (!checkVal.isValid) {
        setGeojsonError(checkVal.errors.join(" "));
      }
      
      setCoords(parsedCoords);
      alert("GeoJSON imported successfully!");
    } catch (err) {
      setGeojsonError(err instanceof Error ? err.message : "Invalid GeoJSON Polygon syntax.");
    }
  };

  // Add vertex manually via input form
  const handleAddVertexManually = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert("Please enter valid decimal coordinates.");
      return;
    }
    
    updateCoords([...coords, [lat, lng]]);
    setNewLat("");
    setNewLng("");
  };

  // Edit coordinate directly in the table
  const handleTableEdit = (index: number, field: "lat" | "lng", val: string) => {
    const floatVal = parseFloat(val);
    if (isNaN(floatVal)) return; // wait for full decimal entry
    
    const newCoords = [...coords];
    if (field === "lat") {
      newCoords[index] = [floatVal, newCoords[index][1]];
    } else {
      newCoords[index] = [newCoords[index][0], floatVal];
    }
    updateCoords(newCoords);
  };

  // Delete vertex in coordinate table
  const handleTableDelete = (index: number) => {
    updateCoords(coords.filter((_, idx) => idx !== index));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans">
      {/* Brand Header */}
      <header className="h-16 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-6 z-20 shadow-md">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-xl text-white">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white uppercase leading-none">
              Heisnam Estate
            </h1>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
              Spatial Boundary Designer
            </span>
          </div>
        </div>

        <Link
          href="/"
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-800 hover:border-slate-700 cursor-pointer shadow-sm"
        >
          <Home className="h-3.5 w-3.5" />
          <span>Dashboard</span>
        </Link>
      </header>

      {/* Main Designer Workspace Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-64px)] overflow-hidden">
        {/* Left Side: Controls & Metrics Panel */}
        <section className="lg:col-span-4 bg-slate-950 border-r border-slate-800/80 flex flex-col h-full overflow-y-auto scrollbar-thin p-5 gap-5">
          {/* Section: Metrics overview */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
              Boundary Diagnostics
            </h2>
            <div className="grid grid-cols-2 gap-3 bg-slate-900 border border-slate-800/60 p-4 rounded-2xl">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Area Calc
                </span>
                <span className="text-sm font-extrabold text-white mt-0.5 block">
                  {area > 1000000 
                    ? `${(area / 1000000).toFixed(3)} km²` 
                    : `${area.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²`}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Perimeter
                </span>
                <span className="text-sm font-extrabold text-white mt-0.5 block">
                  {perimeter > 1000 
                    ? `${(perimeter / 1000).toFixed(2)} km` 
                    : `${perimeter.toLocaleString(undefined, { maximumFractionDigits: 1 })} m`}
                </span>
              </div>
            </div>
            
            {/* Validation Banner */}
            {coords.length > 0 && (
              <div className={`p-3 rounded-2xl border flex gap-2 items-start ${
                validation.isValid 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}>
                {validation.isValid ? (
                  <>
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                    <div>
                      <p className="text-xs font-bold">Topology Valid</p>
                      <p className="text-[10px] text-emerald-500/80 font-medium">Ready for spatial storage</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                    <div>
                      <p className="text-xs font-bold">Topology Error</p>
                      <p className="text-[10px] text-rose-400/80 font-medium leading-relaxed">
                        {validation.errors[0]}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-800/80" />

          {/* Section: Coordinates / Vertices List Table */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
              Granular Coordinates Editor
            </h2>
            {coords.length === 0 ? (
              <div className="text-center py-6 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl">
                <Info className="h-5 w-5 text-slate-500 mx-auto mb-1.5" />
                <span className="text-[11px] font-bold text-slate-500">
                  No vertices drafted. Click on the map in Draw mode to begin.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Scrollable list of vertices */}
                <div className="max-h-52 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-900/50">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        <th className="px-3 py-2 w-10">#</th>
                        <th className="px-3 py-2">Latitude</th>
                        <th className="px-3 py-2">Longitude</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {coords.map((coord, idx) => (
                        <tr key={idx} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                          <td className="px-3 py-2 text-[10px] font-extrabold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="number"
                              step="any"
                              value={coord[0]}
                              onChange={(e) => handleTableEdit(idx, "lat", e.target.value)}
                              className="w-full px-2 py-1 bg-transparent hover:bg-slate-800/50 focus:bg-slate-800 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="number"
                              step="any"
                              value={coord[1]}
                              onChange={(e) => handleTableEdit(idx, "lng", e.target.value)}
                              className="w-full px-2 py-1 bg-transparent hover:bg-slate-800/50 focus:bg-slate-800 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleTableDelete(idx)}
                              className="text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
                              title="Delete point"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Manual Add Vertex Form */}
                <form onSubmit={handleAddVertexManually} className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="Latitude"
                      value={newLat}
                      onChange={(e) => setNewLat(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans"
                    />
                  </div>
                  <div className="col-span-5">
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="Longitude"
                      value={newLng}
                      onChange={(e) => setNewLng(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans"
                    />
                  </div>
                  <div className="col-span-2">
                    <button
                      type="submit"
                      className="w-full h-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                      title="Add coordinate manually"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          <div className="h-px bg-slate-800/80" />

          {/* Section: GeoJSON Paste / Export */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
              GeoJSON Workspace
            </h2>
            <div className="flex flex-col gap-2 relative">
              <textarea
                rows={5}
                value={geoJsonText}
                onChange={(e) => setGeoJsonText(e.target.value)}
                placeholder="Paste valid GeoJSON Polygon here..."
                className="w-full p-3 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-mono text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-normal resize-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-3 right-3 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-800 hover:border-slate-700 shadow"
                title="Copy GeoJSON"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            {geojsonError && (
              <div className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl leading-normal">
                {geojsonError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={handleImportGeoJson}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import Pasted</span>
              </button>
              <a
                href={`data:text/json;charset=utf-8,${encodeURIComponent(geoJsonText)}`}
                download="property_boundary.geojson"
                className={`flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer border border-slate-850 shadow ${
                  coords.length === 0 ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download File</span>
              </a>
            </div>
          </div>
        </section>

        {/* Right Side: Map Canvas */}
        <section className="lg:col-span-8 h-full p-4 bg-slate-900 flex flex-col">
          <div className="flex-1 rounded-3xl overflow-hidden shadow-2xl relative border border-slate-800">
            <DynamicBoundaryEditor
              value={coords}
              onChange={updateCoords}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
