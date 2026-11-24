import { Router, Request, Response } from 'express';

const router = Router();

export interface PlayableTrack {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  channel: string;
  thumbnailUrl: string;
  source: 'youtube' | 'external';
  duration?: string;
  youtubeUrl: string;
  spotifyUrl: string;
}

// GET /api/v1/music/search?q=<query>
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    const cleanEncodedQuery = encodeURIComponent(query);
    const fallbackLinks = {
      youtubeMusicUrl: `https://music.youtube.com/search?q=${cleanEncodedQuery}`,
      youtubeWebUrl: `https://www.youtube.com/results?search_query=${cleanEncodedQuery}`,
      spotifySearchUrl: `https://open.spotify.com/search/${cleanEncodedQuery}`
    };

    if (!youtubeApiKey) {
      // Graceful fallback with quick playable external links + clear warning
      return res.json({
        status: 'fallback',
        warning: 'YOUTUBE_API_KEY is not configured in backend/.env. Playback links provided.',
        query,
        tracks: [
          {
            id: 'yt_fallback_' + Date.now(),
            videoId: '',
            title: query,
            artist: 'Search Query',
            channel: 'YouTube Music / Spotify',
            thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=60',
            source: 'external',
            youtubeUrl: fallbackLinks.youtubeWebUrl,
            spotifyUrl: fallbackLinks.spotifySearchUrl
          }
        ],
        fallbackLinks
      });
    }

    // YouTube Data API v3 search
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=8&q=${cleanEncodedQuery}&key=${youtubeApiKey}`;
    const ytRes = await fetch(url);

    if (!ytRes.ok) {
      const err: any = await ytRes.json().catch(() => ({}));
      console.warn('YouTube API error:', err);
      return res.json({
        status: 'fallback',
        warning: 'YouTube API search failed: ' + (err?.error?.message || ytRes.statusText),
        tracks: [],
        fallbackLinks
      });
    }

    const data: any = await ytRes.json();
    const tracks: PlayableTrack[] = (data?.items || []).map((item: any) => {
      const vid = item.id?.videoId || '';
      return {
        id: vid,
        videoId: vid,
        title: item.snippet?.title?.replace(/&amp;/g, '&')?.replace(/&#39;/g, "'") || query,
        artist: item.snippet?.channelTitle || 'Artist',
        channel: item.snippet?.channelTitle || 'YouTube Music',
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
        source: 'youtube',
        youtubeUrl: `https://www.youtube.com/watch?v=${vid}`,
        spotifyUrl: fallbackLinks.spotifySearchUrl
      };
    });

    return res.json({
      status: 'success',
      query,
      tracks,
      fallbackLinks
    });
  } catch (error: any) {
    console.error('Music search error:', error);
    return res.status(500).json({ error: error.message || 'Failed to search tracks' });
  }
});

export default router;
