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
  Volume2,
  Mic,
  Video,
  Monitor,
  Download,
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

export default function HostPage() {
  const params = useParams();
  const router = useRouter();
  const jamId = params.id as string;

  const [jamSession, setJamSession] = useState<JamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const qrRef = useRef<SVGSVGElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [queuedTracks, setQueuedTracks] = useState<SpotifyTrack[]>([]);
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());

  const participantLink = useMemo(
    () => `http://localhost:3000/jam/${jamId}/participant`,
    [jamId]
  );

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

  useEffect(() => {
    fetchJamSession();
  }, [fetchJamSession]);

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

  const handleAddTrackToJam = (track: SpotifyTrack) => {
    if (addedTrackIds.has(track.id)) {
      return;
    }

    setQueuedTracks((prev) => [...prev, track]);
    setAddedTrackIds((prev) => {
      const updated = new Set(prev);
      updated.add(track.id);
      return updated;
    });
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
                        const isAdded = addedTrackIds.has(track.id);

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
                              disabled={isAdded}
                              className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                                isAdded
                                  ? "border-green-500/60 bg-green-500/20 text-green-300"
                                  : "border-purple-500/50 bg-purple-500/20 text-purple-100 hover:bg-purple-500/30"
                              } disabled:cursor-not-allowed`}
                              title={isAdded ? "Added" : "Add to jam"}
                            >
                              {isAdded ? <Check size={18} /> : <Plus size={18} />}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
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
                  <div className="rounded-full bg-purple-500/20 px-4 py-1 text-sm font-medium text-purple-200">
                    Live
                  </div>
                </div>

                <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-2">
                  {queuedTracks.map((track) => (
                    <div
                      key={`${track.id}-stage`}
                      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur"
                    >
                      <div className="h-16 w-16 overflow-hidden rounded-xl bg-white/10">
                        {track.album?.images?.[0]?.url ? (
                          <Image
                            src={track.album.images[0].url}
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
                          {track.artists.map((artist) => artist.name).join(", ")}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-white/30">
                          {track.album?.name}
                        </p>
                      </div>

                      {track.external_urls?.spotify && (
                        <a
                          href={track.external_urls.spotify}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 transition-all hover:bg-white/10"
                        >
                          Open in Spotify
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-center gap-4">
              {/* Play/Pause */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-r from-purple-600 to-blue-600 shadow-lg shadow-purple-500/50 transition-all hover:shadow-purple-500/70"
              >
                {isPlaying ? (
                  <Pause className="text-white" size={28} />
                ) : (
                  <Play className="ml-1 text-white" size={28} />
                )}
              </motion.button>

              {/* Mute */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`rounded-xl border p-4 transition-all ${
                  isMuted
                    ? "border-red-500/50 bg-red-500/20"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <Mic className={isMuted ? "text-red-400" : "text-white/80"} size={24} />
              </button>

              {/* Volume */}
              <button className="rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10">
                <Volume2 className="text-white/80" size={24} />
              </button>

              {/* Video */}
              <button className="rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10">
                <Video className="text-white/80" size={24} />
              </button>

              {/* Screen Share */}
              <button className="rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10">
                <Monitor className="text-white/80" size={24} />
              </button>
            </div>
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
