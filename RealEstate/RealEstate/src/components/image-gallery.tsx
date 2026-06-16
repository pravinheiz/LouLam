"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import Image from "next/image";

interface ImageGalleryProps {
  images: string[];
  title: string;
}

export function ImageGallery({ images, title }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance in px
  const minSwipeDistance = 50;

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, handleNext, handlePrev]);

  if (!images || images.length === 0) {
    return (
      <div className="w-full aspect-[16/10] bg-slate-100 dark:bg-slate-900 rounded-3xl flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800 text-slate-400">
        <svg
          className="h-16 w-16 mb-4 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="font-semibold text-sm">No Property Images Available</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Main Viewport Container */}
      <div
        className="group relative w-full aspect-[16/10] sm:aspect-[16/9] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200/10 z-10 cursor-pointer"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Next/Prev Navigation */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 cursor-pointer z-20"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 cursor-pointer z-20"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Maximize Button */}
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="absolute top-4 right-4 p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 cursor-pointer z-20"
          aria-label="View fullscreen"
        >
          <Maximize2 className="h-5 w-5" />
        </button>

        {/* Main Image Slider Frame */}
        <div 
          onClick={() => setLightboxOpen(true)}
          className="relative w-full h-full"
        >
          <Image
            src={images[activeIndex]}
            alt={`${title} - view ${activeIndex + 1}`}
            fill
            sizes="(max-width: 1024px) 100vw, 66vw"
            priority={activeIndex === 0}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </div>

        {/* Slide Counter Overlay */}
        <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full text-xs font-bold text-white tracking-wider z-20">
          {activeIndex + 1} / {images.length}
        </div>
      </div>

      {/* Thumbnails strip */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scroll-smooth select-none">
          {images.map((url, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`relative aspect-[4/3] w-20 sm:w-24 rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${
                activeIndex === idx
                  ? "border-indigo-600 scale-[1.03] shadow-md shadow-indigo-500/10"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <Image
                src={url}
                alt={`${title} thumbnail ${idx + 1}`}
                fill
                sizes="96px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[9999] flex flex-col justify-between p-4 md:p-8">
          {/* Header */}
          <div className="flex justify-between items-center w-full z-[10000]">
            <span className="text-white/80 font-bold text-sm md:text-base truncate max-w-[80%]">
              {title}
            </span>
            <button
              onClick={() => setLightboxOpen(false)}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
              aria-label="Close fullscreen view"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Main Slide Panel */}
          <div className="relative flex-grow flex items-center justify-center my-4 select-none">
            <button
              onClick={handlePrev}
              className="absolute left-2 md:left-4 p-4 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer z-[10000]"
            >
              <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
            </button>

            <div className="relative w-full h-full max-w-5xl max-h-[75vh]">
              <Image
                src={images[activeIndex]}
                alt={`${title} fullscreen view ${activeIndex + 1}`}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>

            <button
              onClick={handleNext}
              className="absolute right-2 md:right-4 p-4 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer z-[10000]"
            >
              <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
            </button>
          </div>

          {/* Footer Navigation Strip */}
          <div className="flex flex-col items-center gap-4 z-[10000]">
            <div className="text-white/60 font-semibold text-xs md:text-sm">
              Image {activeIndex + 1} of {images.length}
            </div>
            
            <div className="flex gap-2 max-w-full overflow-x-auto pb-2 scrollbar-thin">
              {images.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  className={`relative aspect-[4/3] w-14 sm:w-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 cursor-pointer ${
                    activeIndex === idx
                      ? "border-white scale-105"
                      : "border-transparent opacity-40 hover:opacity-80"
                  }`}
                >
                  <Image
                    src={url}
                    alt={`${title} thumbnail ${idx + 1}`}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
