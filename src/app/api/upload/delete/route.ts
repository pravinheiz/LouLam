import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { UnauthorizedError, ValidationError } from "@/lib/api-errors";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage, ref, deleteObject } from "firebase/storage";
import fs from "fs";
import path from "path";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase App on the Server
function getServerFirebaseStorage() {
  const apps = getApps();
  const app = apps.length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getStorage(app);
}

/**
 * POST /api/upload/delete
 * Deletes a file from Firebase Storage or local filesystem using its URL.
 * Requires user authentication.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be logged in to delete assets");
  }

  const body = await request.json().catch(() => ({}));
  const { url } = body;

  if (!url) {
    throw new ValidationError("url is required to delete asset");
  }

  // 1. If it's a local fallback file, delete it from public/uploads/
  if (url.startsWith("/uploads/")) {
    try {
      const fileName = url.substring(9); // Remove "/uploads/"
      const filePath = path.join(process.cwd(), "public", "uploads", fileName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Local Delete] Successfully deleted: ${filePath}`);
      }
      return ApiResponse.success(null, "Local asset deleted successfully");
    } catch (err: any) {
      console.error("[Local Delete] Failed:", err);
      throw new ValidationError(`Failed to delete local asset: ${err.message}`);
    }
  }

  // 2. Safety check: Only attempt to delete if it is a Firebase Storage URL
  if (!url.includes("firebasestorage.googleapis.com")) {
    return ApiResponse.success(null, "Asset skipped (not a Firebase Storage URL)");
  }

  // 3. Delete from Firebase Storage
  try {
    const storage = getServerFirebaseStorage();
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
    return ApiResponse.success(null, "Asset deleted successfully from Firebase Storage");
  } catch (error) {
    console.error("[Firebase Delete] Failed:", error);
    throw new ValidationError("Failed to delete asset from Firebase Storage");
  }
});
