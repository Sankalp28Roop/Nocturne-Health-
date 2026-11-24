import { useMusicStore, Track } from '../store/musicStore';
import { apiRequest } from './api';
import { PermissionsService } from './permissions';

export interface FastPathResult {
  handled: boolean;
  message?: string;
}

/**
 * Parses user speech for instantaneous music commands before calling Gemini AI.
 * Handles next song, change song, previous, pause, resume, and specific song search.
 */
export async function tryHandleFastPathVoiceMusic(rawSpeech: string): Promise<FastPathResult> {
  if (!rawSpeech || !rawSpeech.trim()) {
    return { handled: false };
  }

  const text = rawSpeech.toLowerCase().trim();
  const music = useMusicStore.getState();

  // 1. Next / Change Song
  if (
    text === 'change the song' ||
    text === 'change song' ||
    text === 'next song' ||
    text === 'next track' ||
    text === 'skip' ||
    text === 'skip track' ||
    text === 'play next'
  ) {
    await PermissionsService.hapticTap();
    music.nextTrack();
    return { handled: true, message: 'Playing next track.' };
  }

  // 2. Previous Song
  if (
    text === 'previous song' ||
    text === 'previous track' ||
    text === 'last song' ||
    text === 'play previous' ||
    text === 'go back'
  ) {
    await PermissionsService.hapticTap();
    const { queue, currentTrack } = music;
    if (queue.length > 1) {
      const idx = queue.findIndex(t => t.id === currentTrack?.id);
      const prevIdx = (idx - 1 + queue.length) % queue.length;
      music.playTrack(queue[prevIdx]);
    } else {
      music.nextTrack();
    }
    return { handled: true, message: 'Playing previous track.' };
  }

  // 3. Pause / Stop
  if (
    text === 'pause' ||
    text === 'pause music' ||
    text === 'pause the music' ||
    text === 'pause song' ||
    text === 'stop music' ||
    text === 'stop song' ||
    text === 'stop playing'
  ) {
    await PermissionsService.hapticTap();
    music.pause();
    return { handled: true, message: 'Music paused.' };
  }

  // 4. Resume / Play
  if (
    text === 'resume' ||
    text === 'resume music' ||
    text === 'resume the music' ||
    text === 'continue music' ||
    text === 'keep playing'
  ) {
    await PermissionsService.hapticTap();
    music.resume();
    return { handled: true, message: 'Resuming playback.' };
  }

  // 5. Play specific song
  // Patterns like "play Kesariya", "hey friday play Eye of the Tiger", "play a Believer song"
  const isPlayCommand = /^(hey friday\s+|friday\s+)?(play|put on|stream|listen to)\s+/i.test(text);
  if (isPlayCommand) {
    const cleanSongQuery = text
      .replace(/^(hey friday|friday|please)\s*/gi, '')
      .replace(/^(play\s+a|play\s+the|play|put\s+on|stream|listen\s+to)\s+/gi, '')
      .replace(/\s+(song|music|track|beats)$/gi, '')
      .trim();

    if (cleanSongQuery.length > 1) {
      await PermissionsService.hapticTap();
      try {
        const res = await apiRequest(`/music/search?q=${encodeURIComponent(cleanSongQuery)}`);
        if (res.tracks && res.tracks.length > 0) {
          music.playTrack(res.tracks[0]);
          return { handled: true, message: `Playing ${res.tracks[0].title}.` };
        }
      } catch (e) {
        console.warn('Fast path music search failed:', e);
      }
    }
  }

  return { handled: false };
}
