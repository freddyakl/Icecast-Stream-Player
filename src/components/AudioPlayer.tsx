/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import { Play, Pause, Volume2, VolumeX, Volume1 } from "lucide-react";

interface AudioPlayerProps {
  isPlaying: boolean;
  onPlayToggle: () => void;
  volume: number;
  onVolumeChange: (newVol: number) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  isLoading: boolean;
}

export default function AudioPlayer({
  isPlaying,
  onPlayToggle,
  volume,
  onVolumeChange,
  isMuted,
  onMuteToggle,
  isLoading,
}: AudioPlayerProps) {
  const playButtonRef = useRef<HTMLButtonElement>(null);

  // Set up global keyboard navigation for the media player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if the user is typing in an input field
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault(); // Stop page scrolling
          onPlayToggle();
          break;
        case "m":
          e.preventDefault();
          onMuteToggle();
          break;
        case "arrowup":
          e.preventDefault();
          const moreVol = Math.min(1, volume + 0.05);
          onVolumeChange(moreVol);
          break;
        case "arrowdown":
          e.preventDefault();
          const lessVol = Math.max(0, volume - 0.05);
          onVolumeChange(lessVol);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, volume, isMuted, onPlayToggle, onMuteToggle, onVolumeChange]);

  // Determine current speaker icons for dynamic accessibility feedback
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="w-5 h-5" />;
    if (volume < 0.4) return <Volume1 className="w-5 h-5 text-neutral-300" />;
    return <Volume2 className="w-5 h-5 text-indigo-400" />;
  };

  const pctVol = isMuted ? 0 : Math.round(volume * 100);

  return (
    <div
      className="w-full flex flex-col gap-5"
      id="player-control-panel"
      role="region"
      aria-label="Audio player controls"
    >
      {/* Play/Pause control triggers and loader */}
      <div className="flex items-center justify-center">
        <button
          ref={playButtonRef}
          onClick={onPlayToggle}
          disabled={isLoading}
          aria-label={isPlaying ? "Pause stream" : "Play stream"}
          id="play-pause-btn"
          className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg border outline-none
            ${
              isPlaying
                ? "bg-neutral-950 hover:bg-neutral-900 border-indigo-500/50 text-indigo-400 shadow-indigo-600/10"
                : "bg-indigo-500 hover:bg-indigo-400 border-transparent text-white hover:scale-105 active:scale-95 shadow-indigo-500/25"
            }
            focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <div className="w-7 h-7 rounded-full border-3 border-white/20 border-t-white animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-8 h-8 fill-indigo-400 text-indigo-400" />
          ) : (
            <Play className="w-8 h-8 fill-white text-white translate-x-0.5" />
          )}

          {/* Interactive Keyboard Shortcuts Tooltip */}
          <span className="absolute -bottom-1.5 font-mono text-[8px] tracking-wide px-1.5 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-500 uppercase select-none opacity-0 group-hover:opacity-100 transition-opacity">
            [space]
          </span>
        </button>
      </div>

      {/* Accessible Volume Controls Container */}
      <div className="flex items-center gap-3 bg-neutral-950/40 p-3 rounded-xl border border-neutral-800/30">
        <button
          onClick={onMuteToggle}
          aria-label={isMuted ? "Unmute sound" : "Mute sound"}
          className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/50 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          title={`Mute shortcut: [M]`}
        >
          {getVolumeIcon()}
        </button>

        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-[10px] font-mono text-neutral-400 tracking-wide">
            <span>VOLUME</span>
            <span aria-live="polite" className="text-indigo-400">
              {pctVol}%
            </span>
          </div>
          
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            aria-label="Volume level control slider"
            className="w-full h-1.5 rounded-lg bg-neutral-800 appearance-none cursor-pointer accent-indigo-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            title="Adjust volume. Keyboard Shortcuts: [ArrowUp], [ArrowDown]"
          />
        </div>
      </div>

      {/* Quick Keyboard shortcuts guide */}
      <div className="flex justify-around text-[9px] font-mono text-neutral-500 uppercase border-t border-neutral-800/60 pt-3 select-none">
        <span>[Space] Play/Pause</span>
        <span>[▲/▼] Volume</span>
        <span>[M] Mute</span>
      </div>
    </div>
  );
}
