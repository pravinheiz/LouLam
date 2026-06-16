"use client";

import React from "react";
import { PhoneCall } from "lucide-react";

interface ContactSellerButtonProps {
  ownerName: string | null;
  ownerPhone: string | null;
}

export function ContactSellerButton({ ownerName, ownerPhone }: ContactSellerButtonProps) {
  const handleContact = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!ownerPhone) {
      alert(`No phone number is registered for ${ownerName || "this seller"}.`);
      return;
    }
    const confirmCall = window.confirm(`Would you like to call ${ownerName || "the seller"} at ${ownerPhone}?`);
    if (confirmCall) {
      window.location.href = `tel:${ownerPhone}`;
    }
  };

  return (
    <button
      onClick={handleContact}
      className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20"
    >
      <PhoneCall className="h-4 w-4" />
      <span>Contact Seller</span>
    </button>
  );
}
