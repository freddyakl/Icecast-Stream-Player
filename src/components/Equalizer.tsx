/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface EqualizerProps {
  isPlaying: boolean;
  barColor?: string;
}

export default function Equalizer({ isPlaying, barColor = "bg-indigo-500" }: EqualizerProps) {
  // Let's create an array of 12 frequency bars
  const bars = Array.from({ length: 12 });

  return (
    <div
      className="flex items-end justify-center gap-1.5 h-16 w-full max-w-sm px-4 mx-auto"
      style={{ contentVisibility: "auto" }}
      aria-hidden="true"
    >
      {bars.map((_, i) => {
        // We define individual heights and animation delays to make the equalizer look realistic
        const minHeight = "10%";
        const delay = `${i * 0.12}s`;
        const duration = `${0.6 + (i % 3) * 0.25}s`;

        return (
          <div
            key={i}
            className={`w-2.5 rounded-t-md transition-all duration-300 ${barColor}`}
            style={{
              height: isPlaying ? "100%" : minHeight,
              animationName: isPlaying ? "equalizer-bounce" : "none",
              animationDuration: isPlaying ? duration : "0s",
              animationTimingFunction: "ease-in-out",
              animationIterationCount: isPlaying ? "infinite" : "1",
              animationDirection: "alternate",
              animationDelay: delay,
            }}
          />
        );
      })}
    </div>
  );
}
