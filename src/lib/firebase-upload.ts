/**
 * Uploads a file to Firebase Storage via Server Proxy.
 * @param file The file to upload.
 * @param folder The folder path (e.g. 'property-images', 'property-documents').
 * @param onProgress Optional callback for progress tracking (0-100).
 * @returns The resolved public download URL.
 */
export async function uploadToFirebaseStorage(
  file: File,
  folder: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.data?.url) {
            resolve(res.data.url);
          } else {
            reject(new Error(res.message || "Upload failed"));
          }
        } catch {
          reject(new Error("Failed to parse response"));
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          reject(new Error(res.message || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during upload"));
    };

    xhr.send(formData);
  });
}

/**
 * Deletes a file from Firebase Storage via Server Proxy using its URL.
 * @param url The full Firebase Storage download URL.
 */
export async function deleteFromFirebaseStorage(url: string): Promise<void> {
  if (!url) return;

  // Safety check: Only attempt to delete if it is a Firebase Storage URL
  if (!url.includes("firebasestorage.googleapis.com")) {
    console.log("Skipping deletion of non-Firebase Storage URL:", url);
    return;
  }

  try {
    const response = await fetch("/api/upload/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Failed to delete file on server");
    }

    console.log("Successfully deleted file via server proxy:", url);
  } catch (error) {
    console.error("Failed to delete file via server proxy:", error);
  }
}
