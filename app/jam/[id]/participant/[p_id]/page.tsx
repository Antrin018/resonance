"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Music, Loader2, Search } from "lucide-react";
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

type Participant = {
  id: string;
  name: string;
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
  lyrics?: string | null;
  isCurrent?: boolean;
};

export default function ParticipantPage() {
  const params = useParams();
  const router = useRouter();
  const jamId = params.id as string;
  const participantId = params.p_id as string;

  const [jamSession, setJamSession] = useState<JamSession | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);

  const [queuedTracks, setQueuedTracks] = useState<StageTrack[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);

  const participantLink = useMemo(
    () => `http://localhost:3000/jam?action=join&&jamID=${jamId}`,
    [jamId]
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: jamData, error: jamError }, { data: participantData, error: participantError }] =
          await Promise.all([
            supabase.from("jams").select("*").eq("id", jamId).single(),
            supabase.from("participants").select("id, name").eq("id", participantId).single(),
          ]);

        if (jamError) {
          throw jamError;
        }
        setJamSession(jamData);

        if (!participantError && participantData) {
          setParticipant(participantData);
        }

      } catch (error) {
        console.error("Failed to load participant view:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jamId, participantId]);

  useEffect(() => {
    let isCancelled = false;

    const loadSongs = async () => {
      try {
        const { data: songsData, error: songsError } = await supabase
          .from("songs")
          .select("id, song_name, artist, lyrics, current")
          .eq("jam_id", jamId)
          .eq("request", false)
          .order("id", { ascending: true });

        if (songsError) {
          throw songsError;
        }

        const formattedTracks: StageTrack[] = await Promise.all(
          (songsData ?? []).map(async (song) => {
            const songName = song.song_name ?? "Untitled Song";
            const artists =
              song.artist
                ?.split(",")
                .map((artist: string) => artist.trim())
                .filter(Boolean) ?? [];
            const query = [songName, ...artists].filter(Boolean).join(" ");

            const baseTrack: StageTrack = {
              id: song.id,
              name: songName,
              artists,
              lyrics: song.lyrics ?? null,
              isCurrent: Boolean(song.current),
            };

            try {
              const response = await fetch(
                `/api/spotify/search?q=${encodeURIComponent(query || songName)}&limit=1`
              );

              if (!response.ok) {
                throw new Error(`Spotify search failed with status ${response.status}`);
              }

              const payload = await response.json();
              const match: SpotifyTrack | undefined = payload?.tracks?.items?.[0];

              if (match) {
                const matchedArtists = match.artists?.map((artist) => artist.name) ?? artists;
                return {
                  ...baseTrack,
                  name: match.name ?? songName,
                  artists: matchedArtists,
                  albumName: match.album?.name,
                  imageUrl: match.album?.images?.[0]?.url,
                  spotifyUrl: match.external_urls?.spotify,
                  spotifyTrackId: match.id,
                };
              }
            } catch (spotifyError) {
              console.error(`Failed to hydrate song "${songName}" for participant view:`, spotifyError);
            }

            return baseTrack;
          })
        );

        if (!isCancelled) {
          setQueuedTracks(formattedTracks);
          const current = formattedTracks.find((track) => track.isCurrent);
          setCurrentTrackId(current?.id ?? null);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to fetch songs for participant view:", error);
        }
      }
    };

    loadSongs();
    const interval = setInterval(loadSongs, 1000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [jamId]);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-3 text-sm uppercase tracking-wide">Loading your jam view…</span>
      </div>
    );
  }

  if (!jamSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-white">Jam Session Not Found</h1>
          <button
            onClick={() => router.push("/jam?action=join")}
            className="text-purple-400 hover:text-purple-300"
          >
            Go back to join another jam
          </button>
        </div>
      </div>
    );
  }

  const renderLyricsToggle = (track: StageTrack) => {
    if (!track.lyrics) {
      return (
        <button
          type="button"
          disabled
          className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/40"
        >
          Lyrics unavailable
        </button>
      );
    }

    const isExpanded = expandedTrackId === track.id;

    return (
      <button
        type="button"
        onClick={() => setExpandedTrackId(isExpanded ? null : track.id)}
        className="rounded-full bg-linear-to-r from-purple-600 to-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-md shadow-purple-500/40 transition-all hover:shadow-purple-500/70"
      >
        {isExpanded ? "Hide Lyrics" : "View Lyrics"}
      </button>
    );
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black font-sans">
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

      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-1/2 -left-1/4 h-[600px] w-[600px] rounded-full bg-purple-600/30 blur-[120px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/4 h-[600px] w-[600px] rounded-full bg-blue-600/30 blur-[120px]"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
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
                  <p className="text-sm text-white/50">
                    Host: {jamSession.host}
                    {participant?.name ? ` • You: ${participant.name}` : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-white/40">Invite link</p>
              <p className="font-mono text-sm text-white/70">{participantLink}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 py-8">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[380px,1fr]">
          <div className="flex flex-col gap-6">
            <section className="rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur-xl">
              <h2 className="mb-4 text-lg font-semibold text-white">Search Songs</h2>
              <p className="mb-5 text-sm text-white/50">
                Discover tracks to suggest to the host or share inspiration with the group.
              </p>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSearchTracks();
                }}
                className="mb-4 flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search Spotify by song, artist, or album"
                    className="w-full rounded-xl border border-purple-500/40 bg-black/80 py-2.5 pl-10 pr-3 text-sm text-white placeholder-white/40 focus:border-purple-500/60 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!searchQuery.trim() || isSearching}
                  className="rounded-xl bg-linear-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </form>

              {searchError && (
                <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                  {searchError}
                </div>
              )}

              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {isSearching && searchResults.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-center text-white/60">
                    Searching…
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 bg-black/30 p-4 text-center text-sm text-white/40">
                    Use the search bar to explore songs and artists.
                  </div>
                ) : (
                  searchResults.map((track) => {
                    const image = track.album?.images?.[0]?.url;
                    const artists = track.artists.map((artist) => artist.name).join(", ");

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

                        {track.external_urls?.spotify && (
                          <a
                            href={track.external_urls.spotify}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-200 transition-all hover:bg-purple-500/20"
                          >
                            Open
                          </a>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-3xl border border-white/10 bg-linear-to-br from-white/5 via-black/70 to-white/5 p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">Live Setlist</h3>
                  <p className="text-sm text-white/50">
                    {queuedTracks.length} {queuedTracks.length === 1 ? "song" : "songs"} in the queue
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {queuedTracks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-6 text-center text-sm text-white/40">
                    The host hasn’t added any songs yet. Sit tight and enjoy the vibe!
                  </div>
                ) : (
                  queuedTracks.map((track) => {
                    const isActive = track.id === currentTrackId;
                    const cardClassName = [
                      "space-y-3 rounded-2xl border p-4 backdrop-blur transition-shadow",
                      isActive
                        ? "border-purple-500 bg-linear-to-r from-purple-600/20 to-blue-600/15 shadow-[0_0_35px_rgba(168,85,247,0.35)]"
                        : "border-white/10 bg-black/40",
                    ].join(" ");

                    return (
                      <div key={track.id} className={cardClassName}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-14 w-14 overflow-hidden rounded-xl bg-white/10">
                              {track.imageUrl ? (
                                <Image
                                  src={track.imageUrl}
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
                            <div>
                              <p className="text-lg font-semibold text-white">{track.name}</p>
                              <p className="text-sm text-white/60">
                                {track.artists.length > 0 ? track.artists.join(", ") : "Unknown Artist"}
                              </p>
                              {track.albumName && (
                                <p className="text-xs uppercase tracking-wide text-white/30">
                                  {track.albumName}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {renderLyricsToggle(track)}
                            {isActive && (
                              <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-200">
                                Now Playing
                              </span>
                            )}
                          </div>
                        </div>

                        {expandedTrackId === track.id && track.lyrics && (
                          <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/70">
                            <p className="mb-1 text-xs uppercase tracking-wide text-white/40">Lyrics</p>
                            <p className="whitespace-pre-wrap leading-relaxed">{track.lyrics}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}