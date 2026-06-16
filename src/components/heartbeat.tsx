"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Heartbeat Component
 * Client-side hook wrapper that sends a heartbeat ping to /api/user/heartbeat
 * every 2 minutes when the user is logged in.
 */
export function Heartbeat() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user) return;

    const sendHeartbeat = async () => {
      try {
        await fetch("/api/user/heartbeat", { method: "POST" });
      } catch (err) {
        console.error("Heartbeat error:", err);
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Set interval for every 2 minutes (120000ms)
    const interval = setInterval(sendHeartbeat, 120000);

    return () => clearInterval(interval);
  }, [session]);

  return null;
}
