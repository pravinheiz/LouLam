import dynamic from "next/dynamic";
import React from "react";

// Use next/dynamic to load the Leaflet Map component with SSR disabled
// to avoid window-undefined ReferenceErrors during build and server rendering.
export const DynamicMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[350px] bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-800 animate-pulse">
      <div className="text-slate-400 font-medium">Loading Interactive Map...</div>
    </div>
  ),
});
