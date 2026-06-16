"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, X, FileImage, AlertCircle, Loader2 } from "lucide-react";
import { uploadToFirebaseStorage, deleteFromFirebaseStorage } from "@/lib/firebase-upload";

interface ImageUploaderProps {
  initialUrls?: string[];
  initialHashes?: string[];
  onChange: (urls: string[], hashes: string[]) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  maxFiles?: number;
}

interface UploadQueueItem {
  id: string;
  file: File;
  progress: number;
  url?: string;
  publicId?: string;
  error?: string;
  status: "pending" | "uploading" | "success" | "error";
  hash?: string;
}

async function computeSHA256(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Extract success URLs + hashes from an item array and call onChange */
function notifyChange(
  newItems: UploadQueueItem[],
  onChangeFn: (urls: string[], hashes: string[]) => void
) {
  const successItems = newItems.filter((i) => i.status === "success" && i.url);
  onChangeFn(
    successItems.map((i) => i.url as string),
    successItems.map((i) => i.hash || "")
  );
}

export function ImageUploader({
  initialUrls = [],
  initialHashes = [],
  onChange,
  onUploadingChange,
  maxFiles = 5,
}: ImageUploaderProps) {
  const [items, setItems] = useState<UploadQueueItem[]>(() => {
    if (initialUrls && initialUrls.length > 0) {
      return initialUrls.map((url, index) => {
        return {
          id: `initial-${index}`,
          file: new File([], "existing-image"),
          progress: 100,
          url,
          publicId: url,
          hash: initialHashes[index] || "",
          status: "success" as const,
        };
      });
    }
    return [];
  });
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Stable ref so XHR callbacks always call the latest onChange
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  // Notify parent when uploading state changes
  const isUploading = items.some((i) => i.status === "pending" || i.status === "uploading");
  const isUploadingRef = useRef(false);
  useEffect(() => {
    if (isUploading !== isUploadingRef.current) {
      isUploadingRef.current = isUploading;
      onUploadingChange?.(isUploading);
    }
  }, [isUploading, onUploadingChange]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) addFilesToQueue(Array.from(e.dataTransfer.files));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) addFilesToQueue(Array.from(e.target.files));
    // Reset input so same file can be re-selected after removal
    e.target.value = "";
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const addFilesToQueue = (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      alert("Only image files (JPEG, PNG, WEBP, etc.) are allowed.");
      return;
    }

    // Count how many slots are left
    const allowed = maxFiles - items.length;
    if (allowed <= 0) {
      alert(`You can only upload a maximum of ${maxFiles} images.`);
      return;
    }

    const filesToAdd = imageFiles.slice(0, allowed);
    const newItems: UploadQueueItem[] = filesToAdd.map((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      uploadFile(id, file);   // fire-and-forget
      return { id, file, progress: 0, status: "pending" as const };
    });

    setItems((prev) => [...prev, ...newItems]);
  };

  const uploadFile = async (id: string, file: File) => {
    try {
      const hash = await computeSHA256(file);

      // Mark as uploading
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "uploading" } : item))
      );

      const downloadUrl = await uploadToFirebaseStorage(file, "property-images", (progress) => {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, progress } : item))
        );
      });

      setItems((prev) => {
        const newItems = prev.map((item) =>
          item.id === id
            ? {
                ...item,
                progress: 100,
                status: "success" as const,
                url: downloadUrl,
                publicId: downloadUrl,
                hash,
              }
            : item
        );
        notifyChange(newItems, onChangeRef.current);
        return newItems;
      });
    } catch (err: unknown) {
      console.error(`Upload error for ${file.name}:`, err);
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "error", error: errorMsg } : item))
      );
    }
  };

  const handleRemove = async (item: UploadQueueItem) => {
    if (item.status === "success" && item.url) {
      try {
        await deleteFromFirebaseStorage(item.url);
      } catch (err) {
        console.error("Firebase deletion failed:", err);
      }
    }

    setItems((prev) => {
      const newItems = prev.filter((p) => p.id !== item.id);
      notifyChange(newItems, onChangeRef.current);
      return newItems;
    });
  };

  const successCount = items.filter((i) => i.status === "success").length;
  const uploadingCount = items.filter((i) => i.status === "uploading" || i.status === "pending").length;

  return (
    <div className="flex flex-col gap-4 font-sans text-sm">
      {/* Status bar when images exist */}
      {items.length > 0 && (
        <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl ${
          uploadingCount > 0
            ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400"
            : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
        }`}>
          {uploadingCount > 0 ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              Uploading {uploadingCount} photo{uploadingCount > 1 ? "s" : ""}… please wait
            </>
          ) : (
            <>
              ✅ {successCount} photo{successCount > 1 ? "s" : ""} ready — you can submit now
            </>
          )}
        </div>
      )}

      {/* Drop Zone — shown when under maxFiles limit */}
      {items.length < maxFiles && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            dragActive
              ? "border-indigo-500 bg-indigo-500/5"
              : "border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-700"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="bg-indigo-50 dark:bg-indigo-950/30 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 mb-1">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {successCount > 0 ? "Add more photos (optional)" : "Click to upload"}
            </span>{" "}
            {successCount === 0 && "or drag and drop"}
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            {successCount > 0
              ? `${successCount} of ${maxFiles} max uploaded`
              : `PNG, JPG, WEBP, or GIF · up to ${maxFiles} images`}
          </span>
        </div>
      )}

      {/* Upload Queue */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm group hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              {/* Thumbnail */}
              <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-slate-800/50">
                {item.status === "success" && item.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.file.name} className="h-full w-full object-cover" />
                ) : (
                  <FileImage className="h-5 w-5 text-slate-400" />
                )}
              </div>

              {/* Meta */}
              <div className="flex-1 min-w-0 pr-6">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-snug">
                  {item.file.name === "existing-image" ? "Uploaded Asset" : item.file.name}
                </div>

                {item.status === "pending" && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-0.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Preparing…
                  </div>
                )}

                {item.status === "uploading" && (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{item.progress}%</span>
                  </div>
                )}

                {item.status === "success" && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    ✓ Upload complete
                  </span>
                )}

                {item.status === "error" && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 mt-0.5">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span className="truncate">{item.error || "Upload failed"}</span>
                  </div>
                )}
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => handleRemove(item)}
                className="absolute top-3 right-3 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all cursor-pointer"
                title="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
