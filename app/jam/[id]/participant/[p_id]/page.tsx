"use client";

import { useEffect,  useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Music, Loader2, Plus, Check, Trash2 } from "lucide-react";
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

type SongRequest = {
  id: string;
  song_name: string;
  artist: string;
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
  const [songRequests, setSongRequests] = useState<SongRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestingTrackIds, setRequestingTrackIds] = useState<string[]>([]);
  const [deletingRequestIds, setDeletingRequestIds] = useState<string[]>([]);


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
    const fetchRequests = async () => {
      try {
        const { data, error } = await supabase
          .from("requests")
          .select("id, song_name, artist")
          .eq("jam_id", jamId)
          .order("id", { ascending: true });

        if (error) throw error;

        setSongRequests(
          (data ?? []).map((item) => ({
            id: item.id,
            song_name: item.song_name,
            artist: item.artist,
          }))
        );
      } catch (error) {
        console.error("Failed to fetch song requests:", error);
        setRequestError("Unable to load song requests right now.");
      } finally {
        setLoadingRequests((prev) => (prev ? false : prev));
      }
    };

    fetchRequests();

    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, [jamId]);

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
                  <p className="text-sm text-white/50">
                    Host: {jamSession.host}
                    {participant?.name ? ` • You: ${participant.name}` : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl">
              <span className="text-xs uppercase tracking-wide text-white/40">Participant View</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 gap-6 p-6">
        {/* Left Panel - Song Requests & Search */}
        <div className="w-96 shrink-0 space-y-6">
          {/* Song Requests */}
           <div className="flex h-[45vh] flex-col rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur-xl">
             <div className="mb-4 shrink-0">
              <h2 className="text-lg font-semibold text-white">Song Requests</h2>
              <p className="text-sm text-white/50">
                Suggestions from you and other participants
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
              {loadingRequests ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-sm text-white/50">
                  Loading requests…
                </div>
              ) : songRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-4 text-center text-sm text-white/40">
                  No song requests yet. Search below to raise a request.
                </div>
              ) : (
                 songRequests.map((request) => {
                   const isDeleting = deletingRequestIds.includes(request.id);

                   const handleDeleteRequest = async () => {
                     if (isDeleting) return;
                     setRequestError(null);
                     setDeletingRequestIds((prev) => [...prev, request.id]);

                     try {
                       const { error } = await supabase
                         .from("requests")
                         .delete()
                         .eq("id", request.id)
                         .eq("jam_id", jamId);

                       if (error) {
                         throw error;
                       }

                       setSongRequests((prev) => prev.filter((item) => item.id !== request.id));
                     } catch (error) {
                       console.error("Failed to delete song request:", error);
                       setRequestError("Unable to delete this request. Please try again.");
                     } finally {
                       setDeletingRequestIds((prev) => prev.filter((id) => id !== request.id));
                     }
                   };

                   return (
                     <div
                       key={request.id}
                       className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm"
                     >
                       <div className="flex-1 space-y-1">
                         <p className="text-sm font-semibold text-white">{request.song_name}</p>
                         <p className="text-xs uppercase tracking-wide text-white/40">
                           {request.artist || "Unknown Artist"}
                         </p>
                       </div>
                       <button
                         type="button"
                         onClick={handleDeleteRequest}
                         disabled={isDeleting}
                         className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-red-300 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                         title="Delete request"
                       >
                         {isDeleting ? (
                           <Loader2 size={16} className="animate-spin" />
                         ) : (
                           <Trash2 size={16} />
                         )}
                       </button>
                     </div>
                   );
                 })
              )}
            </div>

             {requestError && (
               <div className="mt-4 shrink-0 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                 {requestError}
               </div>
             )}
          </div>

          {/* Search Songs */}
          <div className="flex flex-col rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Search Songs</h2>
                <p className="text-sm text-white/50">
                  Request tracks to the host
                </p>
              </div>
              <p className="text-xs uppercase tracking-wide text-white/40">Spotify</p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSearchTracks();
              }}
              className="mb-4 flex gap-2"
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
                className="rounded-xl bg-linear-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSearching ? "..." : "Search"}
              </button>
            </form>

            {searchError && (
              <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
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
                  Search for a song to raise a request.
                </div>
              ) : (
                searchResults.map((track) => {
                  const image = track.album?.images?.[0]?.url;
                  const artists = track.artists.map((artist) => artist.name).join(", ");
                  const trackKey = track.id ?? track.name.trim().toLowerCase();
                  const isRequesting = requestingTrackIds.includes(trackKey);
                  const alreadyRequested = songRequests.some(
                    (request) =>
                      request.song_name.toLowerCase() === track.name.toLowerCase() &&
                      request.artist.toLowerCase() === artists.toLowerCase()
                  );

                  const handleRaiseRequest = async () => {
                    if (alreadyRequested || isRequesting) return;
                    setRequestError(null);
                    setRequestingTrackIds((prev) => [...prev, trackKey]);

                    try {
                      const { data, error } = await supabase
                        .from("requests")
                        .insert({
                          jam_id: jamId,
                          participant_id: participantId,
                          song_name: track.name,
                          artist: artists,
                        })
                        .select("id, song_name, artist")
                        .single();

                      if (error) {
                        throw error;
                      }

                      setSongRequests((prev) => [
                        ...prev,
                        {
                          id: data.id,
                          song_name: data.song_name,
                          artist: data.artist,
                        },
                      ]);
                    } catch (error) {
                      console.error("Failed to raise song request:", error);
                      setRequestError("Unable to raise request right now. Please try again.");
                    } finally {
                      setRequestingTrackIds((prev) => prev.filter((id) => id !== trackKey));
                    }
                  };

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
                        onClick={handleRaiseRequest}
                        disabled={alreadyRequested || isRequesting}
                        className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                          alreadyRequested
                            ? "border-green-500/60 bg-green-500/20 text-green-300"
                            : isRequesting
                            ? "border-blue-500/60 bg-blue-500/20 text-blue-200"
                            : "border-purple-500/50 bg-purple-500/20 text-purple-100 hover:bg-purple-500/30"
                        } disabled:cursor-not-allowed`}
                        title={
                          alreadyRequested ? "Requested" : isRequesting ? "Requesting..." : "Raise request"
                        }
                      >
                        {alreadyRequested ? (
                          <Check size={18} />
                        ) : isRequesting ? (
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
          </div>
        </div>

        {/* Right Panel - Live Setlist */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 rounded-3xl border border-white/10 bg-linear-to-br from-white/5 via-black/70 to-white/5 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Live Setlist</h3>
                <p className="text-sm text-white/50">
                  {queuedTracks.length} {queuedTracks.length === 1 ? "song" : "songs"} in the queue
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-[calc(100vh-12rem)] space-y-3 overflow-y-auto pr-2">
              {queuedTracks.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mb-4 inline-flex rounded-full bg-purple-500/20 p-8">
                      <Music className="text-purple-400" size={64} />
                    </div>
                    <h3 className="mb-2 text-2xl font-bold text-white">No Songs Yet</h3>
                    <p className="text-white/50">
                      The host hasn&apos;t added any songs yet. Sit tight and enjoy the vibe!
                    </p>
                  </div>
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
                            {track.artists.length > 0 ? track.artists.join(", ") : "Unknown Artist"}
                          </p>
                          <p className="text-xs uppercase tracking-wide text-white/30">
                            {track.albumName ?? "Playlist Entry"}
                          </p>
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
                        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Lyrics</p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">{track.lyrics}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}