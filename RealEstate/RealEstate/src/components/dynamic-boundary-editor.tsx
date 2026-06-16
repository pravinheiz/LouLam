"use client";

import dynamic from "next/dynamic";
import React from "react";
import { Loader2 } from "lucide-react";

// Dynamically import BoundaryMapEditor with SSR disabled to prevent Leaflet window reference errors
export const DynamicBoundaryEditor = dynamic(
  () => import("./boundary-map-editor"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl min-h-[350px] gap-3">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Loading boundary editor context...
        </span>
      </div>
    ),
  }
);
