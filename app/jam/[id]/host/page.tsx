"use client";

import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  Check,
  Plus,
  Users,
  Music,
  Settings,
  Play,
  Pause,
  Download,
  Loader2,
  Trash2,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase-client";
import Image from "next/image";

type JamSession = {
  id: string;
  name: string;
  host: string;
  voting: boolean;
  requests: boolean;
  max_participants: number;
  private: boolean;
  created_at: string;
};

type SpotifyTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images?: { url: string }[];
  };
  external_urls?: {
    spotify?: string;
  };
};

type StageTrack = {
  id: string;
  name: string;
  artists: string[];
  albumName?: string;
  imageUrl?: string;
  spotifyUrl?: string;
  spotifyTrackId?: string;
  lookupKey?: string;
  lyrics?: string | null;
};

const createLookupKey = (name?: string | null, artists: string[] = []) => {
  const parts: string[] = [];
  const trimmedName = name?.trim();
  if (trimmedName) {
    parts.push(trimmedName);
  }
  artists.forEach((artist) => {
    const trimmedArtist = artist?.trim();
    if (trimmedArtist) {
      parts.push(trimmedArtist);
    }
  });
  return parts.join(" ").toLowerCase();
};

export default function HostPage() {
  const params = useParams();
  const router = useRouter();
  const jamId = params.id as string;

  const [jamSession, setJamSession] = useState<JamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const qrRef = useRef<SVGSVGElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [queuedTracks, setQueuedTracks] = useState<StageTrack[]>([]);
  const [addedTrackKeys, setAddedTrackKeys] = useState<Set<string>>(new Set());
  const [addingTrackKeys, setAddingTrackKeys] = useState<string[]>([]);
  const [addSongError, setAddSongError] = useState<string | null>(null);
  const [deletingTrackIds, setDeletingTrackIds] = useState<string[]>([]);
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  const [lyricsMap, setLyricsMap] = useState<Record<string, string>>({});
  const [lyricsFeedback, setLyricsFeedback] = useState<
    Record<string, { type: "success" | "error"; message: string } | null>
  >({});
  const [savingLyricsId, setSavingLyricsId] = useState<string | null>(null);

  const participantLink = useMemo(
    () => `http://localhost:3000/jam?action=join&&jamID=${jamId}`,
    [jamId]
  );

  const buildKeySet = useCallback((tracks: StageTrack[]) => {
    const keys = new Set<string>();
    tracks.forEach((track) => {
      if (track.id) {
        keys.add(track.id);
      }
      if (track.lookupKey) {
        keys.add(track.lookupKey);
      }
      if (track.spotifyTrackId) {
        keys.add(track.spotifyTrackId);
      }
    });
    return keys;
  }, []);

  const fetchJamSession = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("jams")
        .select("*")
        .eq("id", jamId)
        .single();

      if (error) throw error;
      setJamSession(data);
    } catch (error) {
      console.error("Failed to fetch jam session:", error);
    } finally {
      setLoading(false);
    }
  }, [jamId]);

  const fetchSongsForJam = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("songs")
        .select("id, song_name, artist, lyrics")
        .eq("jam_id", jamId)
        .eq("request", false);

      if (error) throw error;

      if (!data || data.length === 0) {
        setQueuedTracks([]);
        setAddedTrackKeys(new Set());
        return;
      }

      const tracks: StageTrack[] = await Promise.all(
        data.map(async (song) => {
          const songName = song.song_name ?? "Untitled Song";
          const artistsFromDb =
            song.artist
              ?.split(",")
              .map((artist: string) => artist.trim())
              .filter(Boolean) ?? [];
          const songLookupKey = createLookupKey(songName, artistsFromDb);
          const spotifyQuery = [songName, ...artistsFromDb].filter(Boolean).join(" ");

          const baseTrack: StageTrack = {
            id: song.id,
            name: songName,
            artists: artistsFromDb,
            lookupKey: songLookupKey,
            lyrics: song.lyrics ?? null,
          };

          try {
            const response = await fetch(
              `/api/spotify/search?q=${encodeURIComponent(spotifyQuery || songName)}&limit=1`
            );

            if (!response.ok) {
              throw new Error(`Spotify search failed with status ${response.status}`);
            }

            const payload = await response.json();
            const match: SpotifyTrack | undefined = payload?.tracks?.items?.[0];

            if (match) {
              const matchedArtists =
                match.artists?.map((artist) => artist.name) ?? artistsFromDb;
              return {
                id: song.id,
                name: match.name ?? songName,
                artists: matchedArtists,
                albumName: match.album?.name,
                imageUrl: match.album?.images?.[0]?.url,
                spotifyUrl: match.external_urls?.spotify,
                spotifyTrackId: match.id,
                lookupKey: createLookupKey(match.name ?? songName, matchedArtists),
              };
            }
          } catch (spotifyError) {
            console.error(
              `Failed to hydrate song "${song.song_name}" with Spotify data:`,
              spotifyError
            );
          }

          return baseTrack;
        })
      );

      setQueuedTracks(tracks);
      setAddedTrackKeys(buildKeySet(tracks));
      setLyricsMap(
        tracks.reduce<Record<string, string>>((acc, track) => {
          if (track.id && track.lyrics) {
            acc[track.id] = track.lyrics;
          }
          return acc;
        }, {})
      );
    } catch (error) {
      console.error("Failed to fetch songs for jam:", error);
    }
  }, [jamId, buildKeySet]);

  useEffect(() => {
    fetchJamSession();
    fetchSongsForJam();
  }, [fetchJamSession, fetchSongsForJam]);

  const handleCopySessionId = () => {
    navigator.clipboard.writeText(jamId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyParticipantLink = () => {
    navigator.clipboard.writeText(participantLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.outerHTML;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jam-${jamId}-participant-qr.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleToggleLyrics = (track: StageTrack) => {
    setLyricsFeedback((prev) => ({ ...prev, [track.id]: null }));
    setExpandedTrackId((prev) => (prev === track.id ? null : track.id));

    if (track.lyrics && !lyricsMap[track.id]) {
      setLyricsMap((prev) => ({ ...prev, [track.id]: track.lyrics ?? "" }));
    }
  };

  const handleSaveLyrics = async (track: StageTrack) => {
    if (!track.id) {
      return;
    }

    const textToSave =
      lyricsMap[track.id]?.trim() ?? track.lyrics?.trim() ?? "";

    if (!textToSave) {
      setLyricsFeedback((prev) => ({
        ...prev,
        [track.id]: { type: "error", message: "Paste lyrics before adding." },
      }));
      return;
    }

    setSavingLyricsId(track.id);
    setLyricsFeedback((prev) => ({ ...prev, [track.id]: null }));

    try {
      const { error } = await supabase
        .from("songs")
        .update({ lyrics: textToSave })
        .eq("id", track.id)
        .eq("jam_id", jamId);

      if (error) {
        throw error;
      }

      setLyricsMap((prev) => ({ ...prev, [track.id]: textToSave }));
      setQueuedTracks((prev) =>
        prev.map((queued) => (queued.id === track.id ? { ...queued, lyrics: textToSave } : queued))
      );
      setLyricsFeedback((prev) => ({
        ...prev,
        [track.id]: { type: "success", message: "Lyrics added to this jam song." },
      }));
    } catch (error) {
      console.error("Failed to save lyrics:", error);
      setLyricsFeedback((prev) => ({
        ...prev,
        [track.id]: { type: "error", message: "Could not save lyrics. Please try again." },
      }));
    } finally {
      setSavingLyricsId(null);
    }
  };

  const handleSearchTracks = async () => {
    const query = searchQuery.trim();
    if (!query || isSearching) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error(`Spotify search failed with status ${response.status}`);
      }

      const data = await response.json();
      const items: SpotifyTrack[] = data?.tracks?.items ?? [];

      setSearchResults(items);
    } catch (error) {
      console.error("Spotify search error:", error);
      setSearchError("Unable to fetch tracks right now. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddTrackToJam = async (track: SpotifyTrack) => {
    const artistsList = track.artists?.map((artist) => artist.name) ?? [];
    const nameKey = (track.name ?? "").trim().toLowerCase();
    const lookupKey = createLookupKey(track.name, artistsList);
    const trackKey = track.id ?? nameKey;

    if (
      addedTrackKeys.has(trackKey) ||
      (nameKey && addedTrackKeys.has(nameKey)) ||
      (lookupKey && addedTrackKeys.has(lookupKey)) ||
      addingTrackKeys.includes(trackKey)
    ) {
      return;
    }

    setAddSongError(null);
    setAddingTrackKeys((prev) => [...prev, trackKey]);

    try {
      const { data, error } = await supabase
        .from("songs")
        .insert({
          jam_id: jamId,
          song_name: track.name,
          artist: artistsList.join(", "),
          request: false,
        })
        .select("id, song_name, artist")
        .single();

      if (error) {
        throw error;
      }

      const fallbackArtists =
        data.artist
          ?.split(",")
          .map((artist: string) => artist.trim())
          .filter(Boolean) ?? [];
      const resolvedArtists = artistsList.length > 0 ? artistsList : fallbackArtists;
      const resolvedLookupKey = createLookupKey(data.song_name, resolvedArtists);

      const stageTrack: StageTrack = {
        id: data.id,
        name: data.song_name,
        artists: resolvedArtists,
        albumName: track.album?.name,
        imageUrl: track.album?.images?.[0]?.url,
        spotifyUrl: track.external_urls?.spotify,
        spotifyTrackId: track.id,
        lookupKey: resolvedLookupKey,
      };

      let updatedTracks: StageTrack[] = [];
      setQueuedTracks((prev) => {
        updatedTracks = [...prev, stageTrack];
        return updatedTracks;
      });
      setAddedTrackKeys(buildKeySet(updatedTracks));
    } catch (error) {
      console.error("Failed to add song to jam:", error);
      setAddSongError("Unable to add song to jam. Please try again.");
    } finally {
      setAddingTrackKeys((prev) => prev.filter((key) => key !== trackKey));
    }
  };

  const handleRemoveTrackFromJam = async (track: StageTrack) => {
    const trackId = track.id;
    if (!trackId || deletingTrackIds.includes(trackId)) {
      return;
    }

    setAddSongError(null);
    setDeletingTrackIds((prev) => [...prev, trackId]);

    try {
      const { error } = await supabase.from("songs").delete().eq("id", trackId).eq("jam_id", jamId);

      if (error) {
        throw error;
      }

      let updatedTracks: StageTrack[] = [];
      setQueuedTracks((prev) => {
        updatedTracks = prev.filter((queued) => queued.id !== trackId);
        return updatedTracks;
      });
      setAddedTrackKeys(buildKeySet(updatedTracks));
      setLyricsMap((prev) => {
        const updated = { ...prev };
        delete updated[trackId];
        return updated;
      });
      setLyricsFeedback((prev) => ({ ...prev, [trackId]: null }));
    } catch (error) {
      console.error("Failed to remove song from jam:", error);
      setAddSongError("Unable to remove song from jam. Please try again.");
    } finally {
      setDeletingTrackIds((prev) => prev.filter((id) => id !== trackId));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!jamSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-white">Jam Session Not Found</h1>
          <button
            onClick={() => router.push("/jam?action=create")}
            className="text-purple-400 hover:text-purple-300"
          >
            Go back to create
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black font-sans">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.15) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(139, 92, 246, 0.15) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-1/2 -left-1/4 h-[600px] w-[600px] rounded-full bg-purple-600/30 blur-[120px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/4 h-[600px] w-[600px] rounded-full bg-blue-600/30 blur-[120px]"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => router.push("/")}
                className="flex items-center gap-2 rounded-xl border border-white/5 bg-linear-to-br from-white/5 via-black/70 to-white/5 px-4 py-2 text-white/60 backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft size={18} />
                Exit
              </motion.button>

              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-linear-to-br from-purple-500/20 to-blue-500/20 p-2 backdrop-blur-sm">
                  <Music className="text-purple-400" size={20} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{jamSession.name}</h1>
                  <p className="text-sm text-white/50">Host: {jamSession.host}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Session ID Display */}
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl">
                <span className="font-mono text-sm text-white/80">{jamId}</span>
                <button
                  onClick={handleCopySessionId}
                  className="rounded-lg p-1 transition-colors hover:bg-white/10"
                  title="Copy session ID"
                >
                  {copied ? (
                    <Check className="text-green-400" size={16} />
                  ) : (
                    <Copy className="text-white/60" size={16} />
                  )}
                </button>
              </div>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 backdrop-blur-xl transition-all hover:bg-white/10"
              >
                <Settings className="text-white/80" size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 gap-6 p-6">
        {/* Left Panel - Participant QR */}
        <div className="w-md shrink-0">
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="text-purple-400" size={20} />
                <h2 className="text-lg font-semibold text-white">Invite Participants</h2>
              </div>
            </div>

            <div className="flex flex-col items-center gap-6">
              <div className="rounded-2xl bg-white/5 p-6 backdrop-blur">
                <QRCodeSVG
                  ref={qrRef}
                  value={participantLink}
                  size={220}
                  includeMargin
                  bgColor="transparent"
                  fgColor="#ffffff"
                />
              </div>

              <div className="w-full space-y-5">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleCopyParticipantLink}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/80 transition-all hover:bg-white/10"
                  >
                    <Copy size={16} />
                    {linkCopied ? "Copied!" : "Copy Link"}
                  </button>
                  <button
                    onClick={handleDownloadQr}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/20 px-4 py-2 text-purple-200 transition-all hover:bg-purple-500/30"
                  >
                    <Download size={16} />
                    Download QR
                  </button>
                    </div>

                <div className="flex h-96 flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Search Songs</h3>
                    <p className="text-xs uppercase tracking-wide text-white/40">Powered by Spotify</p>
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleSearchTracks();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search for a song or artist"
                      className="flex-1 rounded-xl border border-purple-500/40 bg-black/80 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-purple-500/60 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                    <button
                      type="submit"
                      disabled={!searchQuery.trim() || isSearching}
                      className="flex items-center gap-2 rounded-xl bg-linear-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSearching ? "Searching..." : "Search"}
                    </button>
                  </form>
                  {searchError && (
                    <p className="text-sm text-red-400">{searchError}</p>
                  )}

                  <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    {isSearching && searchResults.length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-center text-white/60">
                        Searching...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/15 bg-black/30 p-4 text-center text-sm text-white/40">
                        Search for a song to add it to your jam session.
                      </div>
                    ) : (
                      searchResults.map((track) => {
                        const image = track.album?.images?.[0]?.url;
                        const artists = track.artists.map((artist) => artist.name).join(", ");
                        const trackKey = track.id ?? track.name.trim().toLowerCase();
                        const nameKey = track.name.trim().toLowerCase();
                        const isAdded =
                          addedTrackKeys.has(trackKey) || addedTrackKeys.has(nameKey);
                        const isAdding = addingTrackKeys.includes(trackKey);

                        return (
                          <div
                            key={track.id}
                            className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm"
                          >
                            <div className="h-14 w-14 overflow-hidden rounded-lg bg-white/10">
                              {image ? (
                                <Image
                                  src={image}
                                  alt={track.name}
                                  width={56}
                                  height={56}
                                  className="h-full w-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-white/50">
                                  No Art
                                </div>
                              )}
                            </div>

                            <div className="flex-1">
                              <p className="text-sm font-semibold text-white">{track.name}</p>
                              <p className="text-xs text-white/60">{artists}</p>
                              <p className="text-[11px] uppercase tracking-wide text-white/30">
                                {track.album?.name}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddTrackToJam(track)}
                              disabled={isAdded || isAdding}
                              className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                                isAdded
                                  ? "border-green-500/60 bg-green-500/20 text-green-300"
                                  : isAdding
                                  ? "border-blue-500/60 bg-blue-500/20 text-blue-200"
                                  : "border-purple-500/50 bg-purple-500/20 text-purple-100 hover:bg-purple-500/30"
                              } disabled:cursor-not-allowed`}
                              title={
                                isAdded ? "Added" : isAdding ? "Adding..." : "Add to jam"
                              }
                            >
                              {isAdded ? (
                                <Check size={18} />
                              ) : isAdding ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Plus size={18} />
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {addSongError && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                      {addSongError}
                    </div>
                  )}
                </div>

                </div>
            </div>
          </div>
        </div>

        {/* Center Panel - Main Stage */}
        <div className="flex flex-1 flex-col gap-6">
          {/* Video/Audio Stage */}
          <div className="flex-1 rounded-3xl border border-white/10 bg-linear-to-br from-white/5 via-black/70 to-white/5 p-6 shadow-2xl backdrop-blur-xl">
            {queuedTracks.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                <div className="mb-4 inline-flex rounded-full bg-purple-500/20 p-8">
                  <Music className="text-purple-400" size={64} />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-white">Ready to Jam</h3>
                <p className="text-white/50">
                    Search for songs on the left to start building your setlist.
                </p>
              </div>
            </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Jam Setlist</h3>
                    <p className="text-sm text-white/50">
                      {queuedTracks.length} {queuedTracks.length === 1 ? "song" : "songs"} queued
                    </p>
          </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {/* TODO: handle previous track */}}
                      className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition-all hover:bg-white/10"
                      title="Previous Track"
                    >
                      <span className="sr-only">Previous Track</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19V5m13.5 14L9 12l9.5-7" />
                      </svg>
                    </button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsPlaying(!isPlaying)}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/50 transition-all hover:shadow-purple-500/70"
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause size={20} /> : <Play className="ml-0.5" size={20} />}
              </motion.button>
              <button
                      onClick={() => {/* TODO: handle next track */}}
                      className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition-all hover:bg-white/10"
                      title="Next Track"
                    >
                      <span className="sr-only">Next Track</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 5v14M5.5 5l9.5 7-9.5 7" />
                      </svg>
              </button>
                  </div>
                </div>

                <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-2">
                  {queuedTracks.map((track) => {
                    const isDeleting = deletingTrackIds.includes(track.id);

                    return (
                      <div
                        key={track.id}
                        className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 overflow-hidden rounded-xl bg-white/10">
                            {track.imageUrl ? (
                              <Image
                                src={track.imageUrl}
                                alt={track.name}
                                width={64}
                                height={64}
                                className="h-full w-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-white/50">
                                No Art
                              </div>
                            )}
                          </div>

                          <div className="flex flex-1 flex-col gap-1">
                            <p className="text-lg font-semibold text-white">{track.name}</p>
                            <p className="text-sm text-white/60">
                              {track.artists.length > 0
                                ? track.artists.join(", ")
                                : "Unknown Artist"}
                            </p>
                            <p className="text-xs uppercase tracking-wide text-white/30">
                              {track.albumName ?? "Playlist Entry"}
                            </p>
                          </div>

                        <div className="flex items-center gap-2">
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            type="button"
                            onClick={() => handleToggleLyrics(track)}
                            className="flex items-center gap-2 rounded-full bg-linear-to-r from-purple-600 to-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-md shadow-purple-500/40 transition-all hover:shadow-purple-500/70"
                          >
                            {expandedTrackId === track.id ? "Hide Lyrics" : "Set Lyrics"}
                          </motion.button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTrackFromJam(track)}
                            disabled={isDeleting}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-red-300 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Remove from jam"
                          >
                            {isDeleting ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                            <span className="sr-only">Remove song</span>
              </button>
                        </div>
                      </div>

                      {expandedTrackId === track.id && (
                        <div className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-white">Lyrics</p>
                          </div>

                          <textarea
                            value={lyricsMap[track.id] ?? track.lyrics ?? ""}
                            onChange={(event) =>
                              setLyricsMap((prev) => ({ ...prev, [track.id]: event.target.value }))
                            }
                            rows={6}
                            placeholder="Paste lyrics here..."
                            className="h-48 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/80 placeholder-white/30 focus:outline-none"
                          />
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-white/60">
                              {(lyricsMap[track.id] ?? "").length} characters
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveLyrics(track)}
                              disabled={savingLyricsId === track.id}
                              className="flex items-center gap-2 rounded-full bg-linear-to-r from-purple-600 to-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-purple-500/40 transition-all hover:shadow-purple-500/60 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingLyricsId === track.id ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                "Add Lyrics"
                              )}
              </button>
            </div>
                          {lyricsFeedback[track.id] && (
                            <p
                              className={`text-xs ${
                                lyricsFeedback[track.id]?.type === "success"
                                  ? "text-green-300"
                                  : "text-red-300"
                              }`}
                            >
                              {lyricsFeedback[track.id]?.message}
                            </p>
                          )}
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Panel - Session Info & Settings */}
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-64 shrink-0"
          >
            <div className="rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur-xl">
              <h2 className="mb-6 text-lg font-semibold text-white">Session Settings</h2>

              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-1 text-sm font-medium text-white/80">Max Participants</p>
                  <p className="text-lg font-semibold text-white">{jamSession.max_participants}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-1 text-sm font-medium text-white/80">Voting</p>
                  <p className="text-lg font-semibold text-white">
                    {jamSession.voting ? "Enabled" : "Disabled"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-1 text-sm font-medium text-white/80">Requests</p>
                  <p className="text-lg font-semibold text-white">
                    {jamSession.requests ? "Enabled" : "Disabled"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-1 text-sm font-medium text-white/80">Privacy</p>
                  <p className="text-lg font-semibold text-white">
                    {jamSession.private ? "Private" : "Public"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-1 text-sm font-medium text-white/80">Created</p>
                  <p className="text-sm text-white">
                    {new Date(jamSession.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
