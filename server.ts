/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import http from "http";
import https from "https";
import { URL } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Bypass SSL certificate issues for high-port Icecast stream metadata queries
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Create Express app
const app = express();
const PORT = 3000;

/**
 * Fallback helper function: Queries the Icecast status-json.xsl API standard
 * to obtain real-time title/artist information cleanly without socket-level ICY stream reading.
 */
async function fetchIcecastJsonMetadata(streamUrl: string): Promise<{ title: string; artist: string } | null> {
  try {
    const parsedUrl = new URL(streamUrl);
    const mountpoint = parsedUrl.pathname;
    const jsonUrl = `${parsedUrl.protocol}//${parsedUrl.host}/status-json.xsl`;

    const res = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MixerFM/1.0',
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }

    const data: any = await res.json();
    if (!data || !data.icestats) {
      return null;
    }

    const sources = data.icestats.source;
    if (!sources) {
      return null;
    }

    const sourceList = Array.isArray(sources) ? sources : [sources];
    const cleanMount = mountpoint.startsWith('/') ? mountpoint.substring(1) : mountpoint;

    let matchedSource = sourceList.find((s: any) => {
      const listenUrl = s.listenurl || "";
      const mount = s.mount || "";
      return (
        listenUrl.endsWith('/' + cleanMount) ||
        listenUrl.endsWith(':' + cleanMount) ||
        mount === cleanMount ||
        mount === '/' + cleanMount
      );
    });

    if (!matchedSource && sourceList.length > 0) {
      matchedSource = sourceList[0];
    }

    if (matchedSource) {
      const fullTitle = (matchedSource.title || "").trim();
      const artist = (matchedSource.artist || "").trim();

      if (artist && fullTitle && fullTitle !== artist) {
        return { title: fullTitle, artist };
      } else if (fullTitle) {
        const parts = fullTitle.split(" - ");
        if (parts.length >= 2) {
          return {
            artist: parts[0].trim(),
            title: parts.slice(1).join(" - ").trim(),
          };
        }
        return { title: fullTitle, artist: artist || "" };
      }
    }
    return null;
  } catch (error: any) {
    console.error("fetchIcecastJsonMetadata error:", error.message);
    return null;
  }
}

/**
 * Helpler function: Fetches Icecast/Shoutcast real-time stream metadata (ICY)
 * by making a connection, requesting Icy-Metadata chunk streams, and parsing the StreamTitle chunk.
 */
function fetchIcyMetadata(streamUrl: string): Promise<{ title: string; artist: string; raw: string }> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(streamUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;
      
      const req = lib.request(
        streamUrl,
        {
          rejectUnauthorized: false, // Override Certificate Authorization checks for private streams
          headers: {
            'Icy-Metadata': '1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MixerFM/1.0',
          },
          timeout: 2500, // Safe short timeout to keep server ultra-responsive
        },
        (res) => {
          // If the status is not a 2xx, exit early
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            res.destroy();
            reject(new Error(`HTTP status ${res.statusCode}`));
            return;
          }

          const metaint = parseInt(res.headers['icy-metaint'] as string, 10);
          if (isNaN(metaint) || metaint <= 0) {
            // No icy-metaint found, check if there's any standard info headers
            const icyName = (res.headers['icy-name'] as string) || '';
            const contentType = res.headers['content-type'] as string || '';
            res.destroy();
            resolve({ title: icyName || 'Live Audio Stream', artist: contentType.includes('audio') ? 'Online Radio' : '', raw: '' });
            return;
          }

          let bytesRead = 0;
          let currentMetadataLength = 0;
          let collectingMetadata = false;
          let metadataBuffer = Buffer.alloc(0);

          res.on('data', (chunk: Buffer) => {
            let offset = 0;

            while (offset < chunk.length) {
              if (!collectingMetadata) {
                // Determine how many bytes we need to consumer to hit the next metaint boundary
                const remainingAudio = metaint - bytesRead;
                const chunkRemaining = chunk.length - offset;
                const bytesToConsume = Math.min(remainingAudio, chunkRemaining);

                bytesRead += bytesToConsume;
                offset += bytesToConsume;

                // We touched the boundary
                if (bytesRead === metaint) {
                  if (offset < chunk.length) {
                    const lengthByte = chunk[offset];
                    offset++;
                    currentMetadataLength = lengthByte * 16;
                    bytesRead = 0;

                    if (currentMetadataLength > 0) {
                      collectingMetadata = true;
                      metadataBuffer = Buffer.alloc(0);
                    } else {
                      // Metadata block of 0 length (meaning track hasn't changed or isn't set)
                      collectingMetadata = false;
                    }
                  } else {
                    // Length byte is at the boundary edge, close and try again in next poll
                    res.destroy();
                    resolve({ title: 'Live Stream', artist: '', raw: '' });
                    return;
                  }
                }
              } else {
                // Collecting metadata payload bytes
                const chunkRemaining = chunk.length - offset;
                const bytesToRead = Math.min(currentMetadataLength - metadataBuffer.length, chunkRemaining);

                metadataBuffer = Buffer.concat([metadataBuffer, chunk.slice(offset, offset + bytesToRead)]);
                offset += bytesToRead;

                if (metadataBuffer.length === currentMetadataLength) {
                  const metadataStr = metadataBuffer.toString('utf-8');
                  res.destroy(); // Shut down network socket immediately info gathered!

                  // Match pattern: StreamTitle='Artist - TrackName';
                  const match = metadataStr.match(/StreamTitle='([^']*)'/);
                  if (match && match[1]) {
                    const fullTitle = match[1];
                    const parts = fullTitle.split(' - ');
                    if (parts.length >= 2) {
                      resolve({
                        artist: parts[0].trim(),
                        title: parts.slice(1).join(' - ').trim(),
                        raw: metadataStr,
                      });
                    } else {
                      resolve({
                        artist: '',
                        title: fullTitle.trim(),
                        raw: metadataStr,
                      });
                    }
                  } else {
                    resolve({
                      artist: '',
                      title: metadataStr.trim(),
                      raw: metadataStr,
                    });
                  }
                  return;
                }
              }
            }
          });

          res.on('error', (err) => {
            res.destroy();
            reject(err);
          });
        }
      );

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout connecting to stream'));
      });

      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// Enable JSON parser for body request fields
app.use(express.json());

// API health endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "alive", time: new Date().toISOString() });
});

// API: endpoint to query Icecast stream metadata
app.get("/api/stream-metadata", async (req, res) => {
  const streamUrl = req.query.url as string;
  if (!streamUrl) {
    res.status(400).json({ error: "Query parameter 'url' is required" });
    return;
  }

  try {
    // 1. Try standard Icecast JSON status API first as it is fast and reliable
    console.log(`[Metadata] Querying JSON status metadata for ${streamUrl}`);
    const jsonMeta = await fetchIcecastJsonMetadata(streamUrl);
    if (jsonMeta && (jsonMeta.title || jsonMeta.artist)) {
      console.log(`[Metadata] Found from status-json.xsl: "${jsonMeta.artist}" - "${jsonMeta.title}"`);
      res.json({
        artist: jsonMeta.artist || "Unknown Artist",
        title: jsonMeta.title || "Unknown Track",
        raw: "JSON_API",
        timestamp: Date.now()
      });
      return;
    }

    // 2. Fallback to native ICY real-time stream socket reader
    console.log(`[Metadata] Falling back to ICY socket stream reader for ${streamUrl}`);
    const meta = await fetchIcyMetadata(streamUrl);
    res.json({
      artist: meta.artist || "Unknown Artist",
      title: meta.title || "Unknown Track",
      raw: meta.raw,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error(`Metadata fetch failed for ${streamUrl}:`, error.message);
    res.json({
      artist: "",
      title: "",
      error: error.message || "Failed to retrieve stream metadata",
      timestamp: Date.now()
    });
  }
});

// API: proxy artwork endpoint which queries the free, CORS-friendly iTunes Search API
app.get("/api/artwork", async (req, res) => {
  const artist = req.query.artist as string;
  const track = req.query.track as string;

  if (!artist && !track) {
    res.status(400).json({ error: "At least 'artist' or 'track' parameter is required." });
    return;
  }

  const cleanArtist = (artist || "").trim();
  const cleanTrack = (track || "").trim();
  let artworkUrl = "";

  if (cleanArtist || cleanTrack) {
    try {
      const searchTerm = `${cleanArtist} ${cleanTrack}`.trim();
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=music&limit=1`;
      
      const itunesResponse = await fetch(itunesUrl);
      if (itunesResponse.ok) {
        const data: any = await itunesResponse.json();
        if (data.results && data.results.length > 0) {
          const item = data.results[0];
          const standardArtwork = item.artworkUrl100 || "";
          
          if (standardArtwork) {
            // Replace 100x100 size in url with 600x600 for super high contrast crisp rendering
            artworkUrl = standardArtwork.replace('100x100bb', '600x600bb');
          }
        }
      }
    } catch (e: any) {
      console.error("iTunes artwork search failed:", e.message);
    }
  }

  res.json({ artwork: artworkUrl || "" });
});

// Configure Vite middleware or Static files serving
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap();
