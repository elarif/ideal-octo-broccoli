export interface AudioTrack {
  id: number;
  slug: string;
  title: string;
  url: string;
  duration: number;
}

export interface AudioBook {
  slug: string;
  title: string;
  authorsLabel: string;
  coverUrl?: string;
  tracks: AudioTrack[];
}

export interface AudioState {
  isPlaying: boolean;
  currentBook: AudioBook | null;
  currentTrackIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
}

export interface AudioActions {
  playBook: (book: AudioBook, trackIndex?: number) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  close: () => void;
}

export type AudioContextValue = AudioState & AudioActions;
