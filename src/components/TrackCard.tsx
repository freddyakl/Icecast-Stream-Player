/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Play, Music } from "lucide-react";

interface TrackCardProps {
  title: string;
  artist: string;
  albumArt?: string;
  defaultLogo?: string;
  isLoading?: boolean;
  isPlaying?: boolean;
}

export default function TrackCard({
  title,
  artist,
  albumArt,
  defaultLogo = "/logo.png",
  isLoading = false,
  isPlaying = false,
}: TrackCardProps) {
  const finalArt = albumArt && albumArt.trim() !== "" ? albumArt : defaultLogo;

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto" id="main-track-card">
      {/* Album Cover Wrapper with absolute glowing backing shadow */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 my-6 group">
        {/* Glow behind image */}
        <div
          className="absolute inset-1 rounded-3xl blur-2xl opacity-60 group-hover:opacity-85 transition-opacity duration-700 bg-cover bg-center -z-10 animate-pulse"
          style={{ backgroundImage: `url(${finalArt})`, animationDuration: "6s" }}
        />
        
        {/* Primary Artwork Container */}
        <div className="w-full h-full rounded-2xl overflow-hidden border border-neutral-850 bg-neutral-900 shadow-2xl relative flex items-center justify-center">
          {isLoading ? (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 font-sans">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500/30 border-t-indigo-400 animate-spin mb-3" />
              <p className="text-xs text-neutral-400 font-medium">Fetching Info...</p>
            </div>
          ) : null}

          <img
            src={finalArt}
            alt={albumArt && albumArt.trim() !== "" ? `Album art for ${title} by ${artist}` : "Station Logo"}
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover select-none transition-all duration-700 ${
              isPlaying ? "scale-101 border-indigo-500/40" : "scale-100"
            }`}
          />

          {/* Playing floating badge overlay */}
          {isPlaying && !isLoading && (
            <div className="absolute top-4 right-4 bg-indigo-500 text-white font-mono text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg shadow-indigo-500/20 animate-bounce" style={{ animationDuration: '3s' }}>
              <Play className="w-2.5 h-2.5 fill-white text-white" />
              <span>STREAMING</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
