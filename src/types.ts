/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TrackMetadata {
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  streamUrl: string;
  listeners?: number | string;
  genre?: string;
  bitrate?: string;
  raw?: string;
  timestamp?: number;
}

export interface SongHistoryItem {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  timestamp: string;
}

export interface RadioStation {
  id: string;
  name: string;
  genre: string;
  streamUrl: string;
  description: string;
}
