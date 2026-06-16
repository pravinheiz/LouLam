import { auth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";
import { UnauthorizedError, ValidationError } from "@/lib/api-errors";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

// Initialize or retrieve the Firebase App
function getServerFirebaseApp() {
  const apps = getApps();
  return apps.length > 0 ? getApp() : initializeApp(firebaseConfig);
}

/**
 * POST /api/upload
 * Secure server-side uploader to Firebase Storage with a local filesystem fallback.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be logged in to upload assets");
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    throw new ValidationError("Multipart form data is required");
  }

  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string | null) || "general";

  if (!file) {
    throw new ValidationError("No file provided in form data");
  }

  // Generate a unique identifier to prevent filename collisions
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const storagePath = `${folder}/${uniqueId}-${file.name}`;

  // Convert file stream to ArrayBuffer/Uint8Array
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  let downloadUrl = "";
  let uploadError: any = null;

  // 1. Try Firebase Storage with multiple bucket naming fallback combinations
  const projectId = process.env.FIREBASE_PROJECT_ID || "loulam-1fec9";
  const bucketsToTry = [
    process.env.FIREBASE_STORAGE_BUCKET,
    `${projectId}.appspot.com`,
    `${projectId}.firebasestorage.app`,
  ].filter(Boolean) as string[];

  // Remove duplicate entries
  const uniqueBuckets = Array.from(new Set(bucketsToTry));

  try {
    const app = getServerFirebaseApp();

    for (const bucket of uniqueBuckets) {
      try {
        console.log(`[Firebase Upload] Trying bucket: ${bucket}`);
        const storage = getStorage(app, `gs://${bucket}`);
        const fileRef = ref(storage, storagePath);

        const snapshot = await uploadBytes(fileRef, buffer, {
          contentType: file.type,
        });

        downloadUrl = await getDownloadURL(snapshot.ref);
        console.log(`[Firebase Upload] Success! URL: ${downloadUrl}`);
        break; // Upload succeeded, exit loop
      } catch (err: any) {
        console.warn(`[Firebase Upload] Failed for bucket ${bucket}:`, err?.message || err);
        uploadError = err;
      }
    }
  } catch (appInitErr) {
    console.error("[Firebase App Init] Failed:", appInitErr);
  }

  // 2. If Firebase Storage fails or is not enabled, use local filesystem fallback
  if (!downloadUrl) {
    console.warn("[Upload Fallback] Firebase Storage failed. Falling back to local filesystem...");
    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      
      // Ensure the directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const localFileName = `${uniqueId}-${file.name}`;
      const localFilePath = path.join(uploadsDir, localFileName);

      fs.writeFileSync(localFilePath, Buffer.from(buffer));
      downloadUrl = `/uploads/${localFileName}`;
      console.log(`[Upload Fallback] Success! Saved locally at: ${downloadUrl}`);
    } catch (localErr: any) {
      console.error("[Upload Fallback] Local filesystem save failed:", localErr);
      throw new ValidationError(
        `Upload failed. Firebase Storage Error: ${uploadError?.message || "unknown"}. Local Fallback Error: ${localErr?.message || "unknown"}`
      );
    }
  }

  return ApiResponse.success({ url: downloadUrl }, "File uploaded successfully");
});
