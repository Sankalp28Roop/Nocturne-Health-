import { create } from 'zustand';

export interface Track {
  id: string;
  videoId?: string;
  title: string;
  artist: string;
  channel?: string;
  thumbnailUrl?: string;
  audioUrl?: string; // For local files or streamed audio
  source: 'youtube' | 'local' | 'external';
  youtubeUrl?: string;
  spotifyUrl?: string;
}

interface MusicState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  isDrawerOpen: boolean;
  volume: number; // 0 to 1
  currentTime: number;
  duration: number;
  isSaySongModalOpen: boolean;

  // Actions
  playTrack: (track: Track) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  nextTrack: () => void;
  stop: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  setVolume: (vol: number) => void;
  setProgress: (currentTime: number, duration: number) => void;
  addToQueue: (track: Track) => void;
  setSaySongModalOpen: (open: boolean) => void;
  openSaySongAndListen: () => void;
}

// Built-in starter motivational tracks for instant zero-config playback
const DEFAULT_TRACKS: Track[] = [
  {
    id: 'default-1',
    videoId: 'btPJPFnesV4',
    title: 'Eye of the Tiger',
    artist: 'Survivor',
    channel: 'Survivor Band',
    thumbnailUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&auto=format&fit=crop&q=60',
    source: 'youtube',
    youtubeUrl: 'https://www.youtube.com/watch?v=btPJPFnesV4',
    spotifyUrl: 'https://open.spotify.com/search/Eye%20of%20the%20Tiger%20Survivor'
  },
  {
    id: 'default-2',
    videoId: '7wtfhZwyrcc',
    title: 'Believer',
    artist: 'Imagine Dragons',
    channel: 'ImagineDragons',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&auto=format&fit=crop&q=60',
    source: 'youtube',
    youtubeUrl: 'https://www.youtube.com/watch?v=7wtfhZwyrcc',
    spotifyUrl: 'https://open.spotify.com/search/Believer%20Imagine%20Dragons'
  },
  {
    id: 'default-3',
    videoId: '3JZ_D3ELwOQ',
    title: 'Can\'t Hold Us',
    artist: 'Macklemore & Ryan Lewis',
    channel: 'Macklemore LLC',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&auto=format&fit=crop&q=60',
    source: 'youtube',
    youtubeUrl: 'https://www.youtube.com/watch?v=3JZ_D3ELwOQ',
    spotifyUrl: 'https://open.spotify.com/search/Cant%20Hold%20Us'
  }
];

export const useMusicStore = create<MusicState>((set, get) => ({
  currentTrack: DEFAULT_TRACKS[0],
  queue: DEFAULT_TRACKS,
  isPlaying: false,
  isDrawerOpen: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  isSaySongModalOpen: false,

  playTrack: (track: Track) => {
    const queue = get().queue;
    const exists = queue.find(t => t.id === track.id);
    set({
      currentTrack: track,
      isPlaying: true,
      queue: exists ? queue : [track, ...queue]
    });
  },

  togglePlay: () => {
    set({ isPlaying: !get().isPlaying });
  },

  pause: () => {
    set({ isPlaying: false });
  },

  resume: () => {
    set({ isPlaying: true });
  },

  nextTrack: () => {
    const { queue, currentTrack } = get();
    if (!queue.length) return;
    const currentIndex = queue.findIndex(t => t.id === currentTrack?.id);
    const nextIndex = (currentIndex + 1) % queue.length;
    set({ currentTrack: queue[nextIndex], isPlaying: true, currentTime: 0 });
  },

  stop: () => {
    set({ isPlaying: false, currentTime: 0 });
  },

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () => set({ isDrawerOpen: !get().isDrawerOpen }),
  setVolume: (volume: number) => set({ volume }),
  setProgress: (currentTime: number, duration: number) => set({ currentTime, duration }),
  addToQueue: (track: Track) => set({ queue: [...get().queue, track] }),
  setSaySongModalOpen: (open: boolean) => set({ isSaySongModalOpen: open }),
  openSaySongAndListen: () => set({ isSaySongModalOpen: true })
}));
