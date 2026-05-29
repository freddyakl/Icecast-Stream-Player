/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { Headphones, Radio, Volume2, ShieldAlert, Wifi } from "lucide-react";
import { SongHistoryItem, TrackMetadata, RadioStation } from "./types";
import Equalizer from "./components/Equalizer";
import TrackCard from "./components/TrackCard";
import AudioPlayer from "./components/AudioPlayer";
import SongHistory from "./components/SongHistory";

const DEFAULT_STATION: RadioStation = {
  id: "mixerfm",
  name: "Mixer FM",
  genre: "Electronic / Dance",
  streamUrl: "https://icecast.mixerfm.com:9118/mixerfm",
  description: "Official Mixer FM stream receiver",
};

export default function App() {
  // 1. Core user volume/mute state settings (using localStorage for preservation)
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem("mixer_fm_volume");
    return saved ? parseFloat(saved) : 0.8;
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem("mixer_fm_is_muted");
    return saved === "true";
  });

  // 2. Audio playback state variables
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStation, setCurrentStation] = useState<RadioStation>(DEFAULT_STATION);

  // 3. Metadata tracking state variables
  const [isMetaLoading, setIsMetaLoading] = useState(false);
  const [metadata, setMetadata] = useState<TrackMetadata>({
    title: "Not Streaming",
    artist: "Click Play to Start Stream",
    streamUrl: DEFAULT_STATION.streamUrl,
  });

  // 4. Playback history logs state variables
  const [history, setHistory] = useState<SongHistoryItem[]>(() => {
    const saved = localStorage.getItem("mixer_fm_history");
    return saved ? JSON.parse(saved) : [];
  });

  // Keep references for audio objects and current tracks to avoid race closures
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<TrackMetadata>({
    title: "Not Streaming",
    artist: "Click Play to Start Stream",
    streamUrl: DEFAULT_STATION.streamUrl,
  });

  // Synchronize audio element settings
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // 5. Stream buffering, waiting, and playback event binding
  const initAudioElement = (stationUrl: string): HTMLAudioElement => {
    if (audioRef.current) {
      // Safely cleanup old instance
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.load();
      audioRef.current = null;
    }

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = stationUrl;
    audio.preload = "none";
    audio.volume = isMuted ? 0 : volume;

    // Attach stream loading lifecycle events
    audio.onwaiting = () => {
      setIsLoading(true);
    };

    audio.oncanplay = () => {
      setIsLoading(false);
    };

    audio.onplaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };

    audio.onerror = (e) => {
      console.error("Audio element error caught:", e);
      setIsLoading(false);
      setIsPlaying(false);
    };

    audioRef.current = audio;
    return audio;
  };

  // Main Dynamic Playback Trigger toggle
  const handlePlayToggle = async () => {
    if (isPlaying) {
      // Pause action:
      // Icecast is a live endless stream. To stop download buffering and prevent lag on resume,
      // we must set audio src to an empty stream, load, and teardown!
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.load();
      }
      setIsPlaying(false);
      setIsLoading(false);
    } else {
      // Play action:
      setIsLoading(true);
      try {
        const audio = initAudioElement(currentStation.streamUrl);
        await audio.play();
      } catch (err) {
        console.warn("Autoplay or source access blocked:", err);
        setIsPlayFailed(true);
        setIsPlaying(false);
        setIsLoading(false);
      }
    }
  };

  const [isPlayFailed, setIsPlayFailed] = useState(false);

  // Volume value adjustor
  const handleVolumeChange = (newVal: number) => {
    const rounded = Math.round(newVal * 100) / 100;
    setVolume(rounded);
    localStorage.setItem("mixer_fm_volume", rounded.toString());
    
    // Automatically unmute if user adjusts the slider up
    if (rounded > 0 && isMuted) {
      setIsMuted(false);
      localStorage.setItem("mixer_fm_is_muted", "false");
    }
  };

  // Speaker mute toggler
  const handleMuteToggle = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    localStorage.setItem("mixer_fm_is_muted", nextMute.toString());
  };

  // 6. Metadata and cover art API dynamic polling resolver
  const pollMetadataAndArtwork = async (stationUrl: string) => {
    try {
      setIsMetaLoading(true);
      const res = await fetch(`/api/stream-metadata?url=${encodeURIComponent(stationUrl)}`);
      if (res.ok) {
        const data = await res.json();
        
        let fetchedTitle = (data.title || "").trim();
        let fetchedArtist = (data.artist || "").trim();

        // Safe fallback default labels if empty metadata returned
        if (!fetchedTitle && !fetchedArtist) {
          fetchedTitle = "Live Broadcast";
          fetchedArtist = currentStation.name;
        } else if (!fetchedTitle) {
          fetchedTitle = "On Air";
        } else if (!fetchedArtist) {
          fetchedArtist = currentStation.name;
        }

        // Only search artwork and record logs if track details changed
        const hasTrackChanged =
          fetchedTitle !== currentTrackRef.current.title ||
          fetchedArtist !== currentTrackRef.current.artist;

        if (hasTrackChanged) {
          setIsMetaLoading(true);
          
          let artUrl = "";
          try {
            // Retrieve cover artwork with iTunes search API on backend
            const artRes = await fetch(
              `/api/artwork?artist=${encodeURIComponent(fetchedArtist)}&track=${encodeURIComponent(fetchedTitle)}`
            );
            if (artRes.ok) {
              const artData = await artRes.json();
              artUrl = artData.artwork || "";
            }
          } catch (artErr) {
            console.error("Artwork retrieval error:", artErr);
          }

          // Move current song to history logs before completing state switch (if song is valid)
          const oldTitle = currentTrackRef.current.title;
          const oldArtist = currentTrackRef.current.artist;
          const oldArt = currentTrackRef.current.albumArt || "/logo.png";

          if (
            oldTitle &&
            oldTitle !== "Not Streaming" &&
            oldTitle !== "Connecting..." &&
            oldTitle !== "Live Broadcast" &&
            oldTitle !== "Live Stream"
          ) {
            const timeStr = new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            const oldSongItem: SongHistoryItem = {
              id: Date.now().toString(),
              title: oldTitle,
              artist: oldArtist || "Online Radio",
              albumArt: oldArt,
              timestamp: timeStr,
            };

            setHistory((prev) => {
              // Ignore duplicate titles in nearby logs to keep history diverse
              const filtered = prev.filter(
                (item) => item.title.toLowerCase() !== oldTitle.toLowerCase()
              );
              const updated = [oldSongItem, ...filtered].slice(0, 5);
              localStorage.setItem("mixer_fm_history", JSON.stringify(updated));
              return updated;
            });
          }

          // Write updated Track details to state
          const newMeta: TrackMetadata = {
            title: fetchedTitle,
            artist: fetchedArtist,
            albumArt: artUrl,
            streamUrl: stationUrl,
          };

          setMetadata(newMeta);
          currentTrackRef.current = newMeta;
        }
      }
    } catch (err) {
      console.error("Metadata polling connection error:", err);
    } finally {
      setIsMetaLoading(false);
    }
  };

  // Fetch metadata every 12 seconds
  useEffect(() => {
    pollMetadataAndArtwork(currentStation.streamUrl);

    const timer = setInterval(() => {
      pollMetadataAndArtwork(currentStation.streamUrl);
    }, 12000);

    return () => {
      clearInterval(timer);
    };
  }, [currentStation]);

  // Handle cleanup of elements on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-black text-neutral-200 py-8 px-4 flex flex-col items-center justify-between font-sans">
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-8">
        
        {/* Centered Radio Player Block */}
        <section className="flex flex-col gap-6 w-full max-w-xl mx-auto">
          
          {/* Main Card: Album Art Display & Player Controls */}
          <div className="flex flex-col gap-6 bg-neutral-950/40 border border-neutral-900 rounded-3xl p-6 sm:p-8 shadow-2xl neon-glow-indigo">
            <TrackCard
              title={metadata.title}
              artist={metadata.artist}
              albumArt={metadata.albumArt}
              defaultLogo="/logo.png"
              isLoading={isMetaLoading}
              isPlaying={isPlaying}
            />

            <AudioPlayer
              isPlaying={isPlaying}
              onPlayToggle={handlePlayToggle}
              volume={volume}
              onVolumeChange={handleVolumeChange}
              isMuted={isMuted}
              onMuteToggle={handleMuteToggle}
              isLoading={isLoading}
            />

            {/* Title & Artist Text Elements */}
            <div className="text-center px-4 w-full select-text select-all animate-fade-in" id="track-metadata-display">
              <h2 className="text-xl sm:text-2xl font-light text-white tracking-tight leading-snug truncate px-1" title={metadata.title || "Offline / Not Connected"}>
                {metadata.title || "Not Streaming"}
              </h2>
              <p className="text-base font-medium text-indigo-400 mt-1.5 font-sans truncate px-2" title={metadata.artist || "Standby Mode"}>
                {metadata.artist || "Standby Mode"}
              </p>
            </div>

            <Equalizer isPlaying={isPlaying} barColor="bg-indigo-500 shadow-lg shadow-indigo-500/10" />
          </div>
        </section>

        {/* History Area: Displays the Last 5 songs played with cover arts */}
        <section className="w-full max-w-xl mx-auto mt-2 mb-6">
          <SongHistory history={history} defaultLogo="/logo.png" />
        </section>

      </div>

      {/* Website Footer with professional licensing labels */}
      <footer className="text-center text-[10px] text-neutral-600 uppercase font-mono tracking-wider pt-8 pb-4 select-none w-full border-t border-neutral-900/60 mt-12">
        <p>© 2026 Mixer FM • Crafted with responsive design principles</p>
      </footer>
    </main>
  );
}
