import React, { useState, useEffect, useRef } from 'react';
import { 
  Music, 
  Play, 
  Pause, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Mic, 
  Search, 
  X, 
  Upload, 
  ExternalLink,
  ChevronDown,
  Sparkles,
  Disc3,
  Flame,
  Radio
} from 'lucide-react';
import { useMusicStore, Track } from '../../store/musicStore';
import { apiRequest } from '../../services/api';
import { VoiceEngine } from '../../services/voice';
import { PermissionsService } from '../../services/permissions';
import { hapticFeedback } from '../../services/haptics';

export const MusicPlayerBar: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    isDrawerOpen,
    volume,
    queue,
    playTrack,
    togglePlay,
    pause,
    resume,
    nextTrack,
    stop,
    openDrawer,
    closeDrawer,
    setVolume,
    isSaySongModalOpen,
    setSaySongModalOpen
  } = useMusicStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchWarning, setSearchWarning] = useState<string | null>(null);
  const [fallbackLinks, setFallbackLinks] = useState<any>(null);

  // Say Song Voice recognition
  const [isListeningForSong, setIsListeningForSong] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Hidden audio element for local files or web audio previews
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      if (isPlaying && currentTrack?.audioUrl) {
        audioRef.current.play().catch(console.warn);
      } else if (!isPlaying) {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack, volume]);

  // Helper to clean spoken queries from wake/command filler words
  const cleanSpokenMusicQuery = (raw: string): string => {
    return raw
      .toLowerCase()
      .replace(/^(hey friday|friday|please|can you|could you)\s*/gi, '')
      .replace(/^(play\s+a|play\s+the|play|stream|put\s+on)\s+/gi, '')
      .replace(/\s+(song|music|track|beats)$/gi, '')
      .trim();
  };

  const handleSearch = async (queryText: string, autoPlayTop: boolean = false) => {
    const cleaned = cleanSpokenMusicQuery(queryText);
    if (!cleaned) return;
    setIsSearching(true);
    setSearchWarning(null);

    try {
      const res = await apiRequest(`/music/search?q=${encodeURIComponent(cleaned)}`);
      if (res.warning) setSearchWarning(res.warning);
      if (res.fallbackLinks) setFallbackLinks(res.fallbackLinks);

      if (res.tracks && res.tracks.length > 0) {
        setSearchResults(res.tracks);
        // Automatically start playing top result if requested or if modal was open
        if (autoPlayTop || isSaySongModalOpen) {
          playTrack(res.tracks[0]);
          setSaySongModalOpen(false);
          await PermissionsService.hapticSuccess();
        }
      } else {
        setSearchResults([]);
      }
    } catch (err: any) {
      console.error('Music search failed:', err);
      setSearchWarning(err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const startVoiceSongSearch = async () => {
    setVoiceError(null);
    setSpokenTranscript('');
    setIsListeningForSong(true);
    await PermissionsService.hapticTap();

    const voice = new VoiceEngine({
      onListeningStart: () => setIsListeningForSong(true),
      onTranscript: (text) => {
        setSpokenTranscript(text);
      },
      onListeningEnd: () => {
        setIsListeningForSong(false);
      },
      onError: (err) => {
        setVoiceError(err);
        setIsListeningForSong(false);
      }
    });

    try {
      await voice.startListening();
    } catch (e: any) {
      setVoiceError(e.message || 'Microphone unavailable');
      setIsListeningForSong(false);
    }
  };

  // Auto-listen immediately whenever the modal opens
  useEffect(() => {
    if (isSaySongModalOpen) {
      startVoiceSongSearch();
    } else {
      setIsListeningForSong(false);
    }
  }, [isSaySongModalOpen]);

  // When spoken transcript arrives and speech ends, auto-trigger playback!
  useEffect(() => {
    if (spokenTranscript.trim() && !isListeningForSong && isSaySongModalOpen) {
      handleSearch(spokenTranscript.trim(), true);
    }
  }, [isListeningForSong, spokenTranscript, isSaySongModalOpen]);

  const handleConfirmVoiceSearch = () => {
    if (spokenTranscript.trim()) {
      handleSearch(spokenTranscript.trim(), true);
      setIsListeningForSong(false);
    }
  };

  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const localUrl = URL.createObjectURL(file);
      const customTrack: Track = {
        id: 'local_' + Date.now(),
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Offline Audio File',
        source: 'local',
        audioUrl: localUrl,
        thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=60'
      };
      playTrack(customTrack);
      closeDrawer();
    }
  };

  return (
    <>
      <audio ref={audioRef} src={currentTrack?.audioUrl} />

      {/* Floating Compact "Now Playing" Bar (Visible above bottom nav or during workout) */}
      {currentTrack && !isDrawerOpen && (
        <div className="fixed bottom-20 left-4 right-4 z-40 animate-in slide-in-from-bottom duration-200">
          <div 
            onClick={openDrawer}
            className="flex items-center justify-between p-2.5 rounded-2xl bg-[#141a18]/95 backdrop-blur-xl border border-white/10 shadow-2xl cursor-pointer hover:border-[#4ade80]/40 transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-black/40 flex-shrink-0 border border-white/10 flex items-center justify-center">
                {currentTrack.thumbnailUrl ? (
                  <img src={currentTrack.thumbnailUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
                ) : (
                  <Disc3 className={`w-5 h-5 text-[#4ade80] ${isPlaying ? 'animate-spin' : ''}`} />
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center gap-0.5">
                    <span className="w-0.5 bg-[#4ade80] rounded-full equalizer-bar-1" />
                    <span className="w-0.5 bg-[#86efac] rounded-full equalizer-bar-2" />
                    <span className="w-0.5 bg-[#4ade80] rounded-full equalizer-bar-3" />
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate group-hover:text-[#4ade80] transition-colors">
                  {currentTrack.title}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-[#869486] truncate">
                  <span className="truncate">{currentTrack.artist}</span>
                  {isPlaying ? (
                    <span className="text-[#4ade80] flex items-center gap-1 font-semibold">
                      <span className="w-1 h-1 rounded-full bg-[#4ade80] animate-ping" />
                      Playing
                    </span>
                  ) : (
                    <span>• Paused</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-[#4ade80] text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-glow-primary"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
              </button>

              <button 
                onClick={nextTrack}
                className="w-8 h-8 rounded-full bg-white/5 text-white/80 hover:text-white flex items-center justify-center hover:bg-white/10 transition-all"
                title="Next Track"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button 
                onClick={() => setSaySongModalOpen(true)}
                className="w-8 h-8 rounded-full bg-white/5 text-[#4ade80] hover:bg-[#4ade80]/15 flex items-center justify-center transition-all ml-1"
                title="Say a Song Name"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Music Player Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-h-[90vh] bg-[#0c0f0e] border-t border-white/10 rounded-t-[36px] p-6 shadow-2xl overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#4ade80]/15 flex items-center justify-center text-[#4ade80]">
                  <Music className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-black text-sm text-white">Nocturne Music</h3>
                  <p className="text-[10px] text-[#869486]">Voice & Friday AI Controlled</p>
                </div>
              </div>

              <button 
                onClick={() => {
                  hapticFeedback.light();
                  closeDrawer();
                }}
                className="w-8 h-8 rounded-full bg-white/5 text-white/70 hover:text-white flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Now Playing Featured Card */}
            {currentTrack && (
              <div className="my-5 p-4 rounded-3xl bg-gradient-to-b from-[#141a18] to-[#0c0f0e] border border-white/10 shadow-lg flex flex-col items-center text-center">
                <div className="w-40 h-40 rounded-2xl overflow-hidden shadow-2xl mb-4 border border-white/15 relative">
                  {currentTrack.thumbnailUrl ? (
                    <img src={currentTrack.thumbnailUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#1a231f] flex items-center justify-center">
                      <Disc3 className={`w-14 h-14 text-[#4ade80] ${isPlaying ? 'animate-spin' : ''}`} />
                    </div>
                  )}
                  {isPlaying && (
                    <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-[#4ade80] text-black font-bold text-[9px] uppercase tracking-wider shadow-glow-primary">
                      Playing
                    </div>
                  )}
                </div>

                <h4 className="font-display font-black text-base text-white max-w-xs truncate">
                  {currentTrack.title}
                </h4>
                <p className="text-xs text-[#869486] mt-0.5 max-w-xs truncate">
                  {currentTrack.artist} {currentTrack.channel ? `• ${currentTrack.channel}` : ''}
                </p>

                {/* Controls */}
                <div className="flex items-center gap-6 mt-5">
                  <button 
                    onClick={nextTrack}
                    className="w-10 h-10 rounded-full bg-white/5 text-white/80 hover:text-white flex items-center justify-center hover:bg-white/10 transition-all rotate-180"
                    title="Previous Track"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={togglePlay}
                    className="w-14 h-14 rounded-full bg-gradient-to-r from-white via-[#86efac] to-[#4ade80] text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-glow-primary"
                  >
                    {isPlaying ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black ml-1" />}
                  </button>

                  <button 
                    onClick={nextTrack}
                    className="w-10 h-10 rounded-full bg-white/5 text-white/80 hover:text-white flex items-center justify-center hover:bg-white/10 transition-all"
                    title="Next Track"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* External App Streaming Options */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5 w-full justify-center">
                  {currentTrack.youtubeUrl && (
                    <a 
                      href={currentTrack.youtubeUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[11px] font-medium transition-colors"
                    >
                      <Radio className="w-3 h-3" />
                      <span>Watch on YouTube</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                  {currentTrack.spotifyUrl && (
                    <a 
                      href={currentTrack.spotifyUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1db954]/10 text-[#1db954] hover:bg-[#1db954]/20 text-[11px] font-medium transition-colors"
                    >
                      <Disc3 className="w-3 h-3" />
                      <span>Open in Spotify</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Quick Voice & Manual Song Search */}
            <div className="space-y-3 mb-6">
              <button 
                onClick={() => setSaySongModalOpen(true)}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#4ade80]/20 via-[#141a18] to-[#141a18] border border-[#4ade80]/40 flex items-center justify-between text-left hover:border-[#4ade80] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#4ade80] text-black flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-xs text-white">"Say a Song Name"</p>
                    <p className="text-[10px] text-[#869486]">Voice-to-Play instantly with Friday</p>
                  </div>
                </div>
                <Sparkles className="w-4 h-4 text-[#4ade80]" />
              </button>

              {/* Text Search Input */}
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-[#141a18] rounded-xl px-3.5 py-2.5 border border-white/10">
                  <Search className="w-4 h-4 text-[#869486]" />
                  <input 
                    type="text"
                    placeholder="Search song or artist..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                    className="bg-transparent text-xs text-white w-full focus:outline-none"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-white/40 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button 
                  onClick={() => handleSearch(searchQuery)}
                  disabled={isSearching}
                  className="px-4 py-2.5 rounded-xl bg-white/10 text-white font-display font-bold text-xs hover:bg-white/20 transition-all"
                >
                  {isSearching ? '...' : 'Search'}
                </button>
              </div>

              {/* Search Warning / Fallback Banner */}
              {searchWarning && (
                <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-[11px] flex items-center justify-between">
                  <span>{searchWarning}</span>
                  {fallbackLinks && (
                    <a 
                      href={fallbackLinks.spotifySearchUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="underline font-bold ml-2 text-white"
                    >
                      Search Spotify
                    </a>
                  )}
                </div>
              )}

              {/* Offline File Picker */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#869486]">Offline Gym Music?</span>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[11px] text-[#4ade80] hover:bg-white/10 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  <span>Choose Local MP3</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="audio/*" 
                  className="hidden" 
                  onChange={handleLocalFileUpload} 
                />
              </div>
            </div>

            {/* Track Results / Queue */}
            <div className="space-y-2 flex-1">
              <h5 className="font-display font-bold text-xs text-[#869486] uppercase tracking-wider">
                {searchResults.length > 0 ? 'Search Results' : 'Recommended Workout Queue'}
              </h5>

              <div className="space-y-1.5">
                {(searchResults.length > 0 ? searchResults : queue).map((track) => (
                  <div 
                    key={track.id}
                    onClick={() => { playTrack(track); closeDrawer(); }}
                    className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all ${
                      currentTrack?.id === track.id 
                        ? 'bg-[#4ade80]/15 border border-[#4ade80]/40' 
                        : 'bg-[#141a18]/60 hover:bg-[#141a18] border border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-black/40 flex-shrink-0">
                        {track.thumbnailUrl ? (
                          <img src={track.thumbnailUrl} alt={track.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#4ade80]">
                            <Disc3 className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${currentTrack?.id === track.id ? 'text-[#4ade80]' : 'text-white'}`}>
                          {track.title}
                        </p>
                        <p className="text-[10px] text-[#869486] truncate">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    <button className="w-7 h-7 rounded-full bg-white/5 text-white flex items-center justify-center hover:bg-[#4ade80] hover:text-black transition-colors">
                      <Play className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* "Say a Song Name" Voice Overlay Modal */}
      {isSaySongModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-[32px] bg-[#141a18] border border-white/10 p-6 text-center shadow-2xl relative">
            <button 
              onClick={() => { setIsListeningForSong(false); setSaySongModalOpen(false); }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 text-white/70 hover:text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-3xl bg-[#4ade80]/20 border border-[#4ade80]/40 flex items-center justify-center text-[#4ade80] mx-auto mb-4 relative">
              <Mic className="w-8 h-8" />
              {isListeningForSong && (
                <span className="absolute inset-0 rounded-3xl border-2 border-[#4ade80] animate-ping opacity-60" />
              )}
            </div>

            <h3 className="font-display font-black text-lg text-white">Say a Song Name</h3>
            <p className="text-xs text-[#869486] mt-1">
              Friday will search and play it for your workout
            </p>

            {voiceError && (
              <p className="text-xs text-red-400 mt-2 bg-red-500/10 p-2 rounded-xl border border-red-500/20">
                {voiceError}
              </p>
            )}

            <div className="my-6 p-4 rounded-2xl bg-black/40 border border-white/5 min-h-[64px] flex items-center justify-center">
              <p className="text-sm font-medium text-white italic">
                {spokenTranscript ? `"${spokenTranscript}"` : isListeningForSong ? 'Listening...' : 'Tap Mic to start speaking'}
              </p>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={startVoiceSongSearch}
                className="flex-1 py-3 rounded-full bg-white/10 text-white font-display font-bold text-xs uppercase tracking-wider hover:bg-white/20 transition-all"
              >
                {isListeningForSong ? 'Listening...' : 'Speak Again'}
              </button>
              {spokenTranscript && (
                <button 
                  onClick={handleConfirmVoiceSearch}
                  className="flex-1 py-3 rounded-full bg-[#4ade80] text-black font-display font-bold text-xs uppercase tracking-wider hover:bg-[#6bfb9a] transition-all shadow-glow-primary"
                >
                  Play Song
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
