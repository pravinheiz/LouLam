import { withErrorHandler } from "@/lib/with-error-handler";
import { ApiResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/otp/config
 * Exposes the public Firebase client configuration to the frontend if defined in .env.
 */
export const GET = withErrorHandler(async () => {
  const apiKey = process.env.FIREBASE_API_KEY;
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.FIREBASE_APP_ID;

  const isConfigured = !!(
    apiKey &&
    authDomain &&
    projectId &&
    storageBucket &&
    messagingSenderId &&
    appId
  );

  if (isConfigured) {
    return ApiResponse.success({
      firebaseEnabled: true,
      config: {
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId,
      },
    });
  } else {
    return ApiResponse.success({
      firebaseEnabled: false,
    });
  }
});
