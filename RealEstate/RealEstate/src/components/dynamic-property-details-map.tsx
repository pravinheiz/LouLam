"use client";

import dynamic from "next/dynamic";
import React from "react";

// Load Leaflet component dynamically with SSR disabled to prevent server-side rendering errors
export const DynamicPropertyDetailsMap = dynamic(() => import("./property-details-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[380px] bg-slate-100 dark:bg-slate-900 rounded-3xl flex items-center justify-center border border-slate-200 dark:border-slate-800 animate-pulse">
      <div className="text-slate-400 font-semibold text-sm">Loading Interactive Map...</div>
    </div>
  ),
});
