import React from "react";
import { ArrowLeft, Compass } from "lucide-react";

export default function PropertyDetailLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-16 animate-pulse">
      {/* Navigation Header Skeleton */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 h-16 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 dark:text-slate-700 py-1.5 px-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
              <ArrowLeft className="h-4 w-4" />
              <span>Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-slate-200 dark:bg-slate-800 p-1.5 rounded-lg text-slate-400">
              <Compass className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-sm tracking-wide bg-slate-200 dark:bg-slate-800 text-transparent rounded select-none">
              LOULAM
            </span>
          </div>
        </div>
      </header>

      {/* Main Container Skeleton */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Breadcrumb skeleton */}
        <div className="w-48 h-4 bg-slate-200 dark:bg-slate-800 rounded-lg mb-6"></div>

        {/* 2-Column Desktop Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Info Column (Left 2/3) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Gallery Wrapper skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-4 shadow-sm">
              <div className="w-full aspect-[16/10] sm:aspect-[16/9] bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
            </div>

            {/* Title & Metadata Card skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
              <div className="flex gap-2">
                <div className="w-16 h-5 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                <div className="w-16 h-5 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-2 w-2/3">
                  <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/2"></div>
                </div>
                <div className="w-24 h-8 bg-slate-200 dark:bg-slate-800 rounded-xl shrink-0"></div>
              </div>
            </div>

            {/* Overview skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
              <div className="w-32 h-6 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
              <div className="h-px bg-slate-100 dark:bg-slate-850" />
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-full"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-[95%]"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-[90%]"></div>
              </div>
            </div>

            {/* Technical Specifications Grid skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
              <div className="w-40 h-6 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
              <div className="h-px bg-slate-100 dark:bg-slate-850" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-2xl"></div>
                <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-2xl"></div>
                <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-2xl"></div>
                <div className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-2xl"></div>
              </div>
            </div>

          </div>

          {/* Sticky Sidebar Column (Right 1/3) */}
          <div className="space-y-8">
            
            {/* Spatial Valuation Estimate Card skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="w-28 h-5 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
              <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-3/4"></div>
              <div className="h-px bg-slate-100 dark:bg-slate-850" />
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/2"></div>
                <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-2xl w-full"></div>
              </div>
            </div>

            {/* Bounding Map skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-4 shadow-sm space-y-4">
              <div className="w-32 h-5 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
              <div className="h-[380px] bg-slate-100 dark:bg-slate-850 rounded-2xl w-full"></div>
            </div>

            {/* Seller Contact Card skeleton */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="w-24 h-5 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
                <div className="space-y-2 w-1/2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-full"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-lg w-2/3"></div>
                </div>
              </div>
              <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
