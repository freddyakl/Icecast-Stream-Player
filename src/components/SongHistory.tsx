/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { History, Headphones } from "lucide-react";
import { SongHistoryItem } from "../types";

interface SongHistoryProps {
  history: SongHistoryItem[];
  defaultLogo?: string;
  onSelectTrackSearch?: (item: SongHistoryItem) => void;
}

export default function SongHistory({
  history,
  defaultLogo = "/logo.png",
  onSelectTrackSearch,
}: SongHistoryProps) {
  return (
    <div
      className="bg-neutral-900/90 border border-neutral-800/80 rounded-2xl p-6 shadow-xl w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-[760px] mx-auto backdrop-blur-md"
      id="playback-history-log"
      role="region"
      aria-label="Recently played tracks history"
    >
      <div className="flex items-center gap-2 border-b border-neutral-800/60 pb-3 mb-4">
        <History className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-sans">
          RECENTLY PLAYED LOG
        </h3>
        <span className="text-[10px] font-mono text-neutral-500 ml-auto bg-neutral-950 p-1 px-2 border border-neutral-800/40 rounded">
          LAST 5 TRACKS
        </span>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-neutral-500 font-sans">
          <Headphones className="w-8 h-8 opacity-20 mb-2.5 animate-pulse text-indigo-400" />
          <p className="text-xs">History container logging start.</p>
          <p className="text-[10px] text-neutral-600 mt-1 uppercase font-mono">
            Tracks will log as metadata changes
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 font-sans">
          {history.map((item, index) => {
            const finalThumb =
              item.albumArt && item.albumArt.trim() !== "" ? item.albumArt : defaultLogo;

            return (
              <div
                key={item.id}
                className="flex items-center gap-3.5 bg-neutral-950/45 border border-neutral-800/30 p-2.5 rounded-xl hover:bg-neutral-950/80 hover:border-indigo-500/15 transition-all text-left outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 group"
                id={`history-item-${item.id}`}
              >
                {/* Micro Cover Art Thumb */}
                <div className="w-11 h-11 shrink-0 bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 shadow relative">
                  <img
                    src={finalThumb}
                    alt={`Cover for ${item.title}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] text-indigo-400 font-bold bg-neutral-950/90 rounded px-1 tracking-tighter">
                      #{index + 1}
                    </span>
                  </div>
                </div>

                {/* Track titles info */}
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-xs font-semibold text-white truncate leading-snug">
                    {item.title}
                  </div>
                  <div className="text-[10px] font-medium text-neutral-400 md:text-indigo-400/80 truncate mt-0.5">
                    {item.artist}
                  </div>
                </div>

                {/* Local clock log timestamp tag */}
                <div className="shrink-0 text-[9px] font-mono text-neutral-500 text-right">
                  <time dateTime={item.timestamp}>{item.timestamp}</time>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
