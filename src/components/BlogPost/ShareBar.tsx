"use client";

import { useState } from "react";

const shareButtons = [
  { label: "Twitter/X", icon: "𝕏", url: (text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}` },
  { label: "LinkedIn", icon: "in", url: (text: string) => `https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(text)}` },
  { label: "Facebook", icon: "f", url: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}` },
];

export default function ShareBar() {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="flex items-center gap-2 py-4 border-t border-b border-gray-200 my-6">
      <span className="text-xs text-gray-400 font-medium mr-1">Share</span>
      {shareButtons.map((btn) => (
        <a
          key={btn.label}
          href={btn.url(typeof window !== "undefined" ? window.location.href : "")}
          target="_blank"
          rel="noopener noreferrer"
          title={btn.label}
          className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-[0.7rem] text-gray-500 cursor-pointer hover:bg-navy hover:text-white hover:border-navy transition-all duration-150 no-underline"
        >
          {btn.icon}
        </a>
      ))}
      <button
        onClick={copyLink}
        title="Copy link"
        className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-[0.6rem] text-gray-500 cursor-pointer hover:bg-navy hover:text-white hover:border-navy transition-all duration-150"
      >
        {copied ? "✓" : "🔗"}
      </button>
    </div>
  );
}
