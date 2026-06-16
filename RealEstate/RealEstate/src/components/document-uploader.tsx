"use client";

import React, { useState, useRef } from "react";
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { uploadToFirebaseStorage, deleteFromFirebaseStorage } from "@/lib/firebase-upload";

interface DocumentUploaderProps {
  initialUrl?: string;
  initialHash?: string;
  onChange: (url: string, hash: string) => void;
  label?: string;
}

async function computeSHA256(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

export function DocumentUploader({
  initialUrl = "",
  initialHash = "",
  onChange,
  label = "Property Verification Document",
}: DocumentUploaderProps) {
  const [fileUrl, setFileUrl] = useState(initialUrl);
  const [fileHash, setFileHash] = useState(initialHash);
  const [fileName, setFileName] = useState(initialUrl ? "Uploaded Document" : "");
  const [status, setStatus] = useState<"idle" | "hashing" | "uploading" | "success" | "error">(
    initialUrl ? "success" : "idle"
  );
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const processFile = async (file: File) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Only PDF files and images (JPEG, PNG, WEBP) are allowed as documents.");
      return;
    }

    try {
      setStatus("hashing");
      setErrorMsg("");
      setFileName(file.name);

      // 1. Compute SHA-256 Hash
      const hash = await computeSHA256(file);
      setFileHash(hash);

      // 2. Upload to Firebase Storage
      setStatus("uploading");
      
      const downloadUrl = await uploadToFirebaseStorage(file, "property-documents", (pct) => {
        setProgress(pct);
      });

      setFileUrl(downloadUrl);
      setStatus("success");
      onChange(downloadUrl, hash);

    } catch (err: unknown) {
      console.error("Document upload error:", err);
      const msg = err instanceof Error ? err.message : "Failed to upload document";
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  const handleRemove = async () => {
    if (fileUrl) {
      try {
        await deleteFromFirebaseStorage(fileUrl);
      } catch (err) {
        console.error("Firebase document deletion failed:", err);
      }
    }
    setFileUrl("");
    setFileHash("");
    setFileName("");
    setStatus("idle");
    setProgress(0);
    setErrorMsg("");
    onChange("", "");
  };

  return (
    <div className="flex flex-col gap-2 font-sans text-sm">
      <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        {label} <span className="text-red-500">*</span>
      </label>

      {status === "idle" && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            dragActive
              ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"
          }`}
        >
          <Upload className="w-6 h-6 text-slate-400" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Upload verification document
            </span>
            <span className="text-xs text-slate-400">PDF, JPG, PNG or WEBP up to 10MB</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {(status === "hashing" || status === "uploading") && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                {fileName}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {status === "hashing" ? "hashing..." : `${progress}%`}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full transition-all duration-300"
                style={{ width: `${status === "hashing" ? 10 : progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-500 flex-shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate text-xs">
                {fileName}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Verified & Uploaded
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="border border-red-200 dark:border-red-950/30 rounded-2xl p-4 bg-red-50/50 dark:bg-red-950/10 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="font-medium text-red-800 dark:text-red-400 truncate text-xs">
                {fileName}
              </span>
              <span className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                {errorMsg}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-500 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
