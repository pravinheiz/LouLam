/**
 * Injects Cloudinary transformations into a Cloudinary delivery URL.
 * If the URL is not a Cloudinary URL, it returns the URL unchanged.
 *
 * @param url The image URL.
 * @param transforms Cloudinary transformation string (e.g., "q_auto,f_auto,w_800,c_fill").
 * @returns The optimized URL.
 */
export function getOptimizedImageUrl(url: string, transforms: string): string {
  if (!url) return "";
  
  // Verify it is a Cloudinary delivery URL
  if (!url.includes("res.cloudinary.com")) {
    return url;
  }
  
  // Find "/upload/" in the URL
  const uploadIndex = url.indexOf("/upload/");
  if (uploadIndex === -1) {
    return url;
  }
  
  // Insert the transformations immediately after "/upload/"
  const prefix = url.substring(0, uploadIndex + 8); // Includes "/upload/"
  const suffix = url.substring(uploadIndex + 8);
  
  return `${prefix}${transforms}/${suffix}`;
}
