"use client";

import dynamic from "next/dynamic";
import React from "react";
import { Loader2 } from "lucide-react";

// Dynamically import LocationPickerMap with SSR disabled to prevent Leaflet window reference errors
export const DynamicLocationPicker = dynamic(
  () => import("./location-picker-map"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-96 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl gap-2 min-h-[360px]">
        <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
        <span className="text-[10px] font-bold text-slate-400">
          Loading map context...
        </span>
      </div>
    ),
  }
);
