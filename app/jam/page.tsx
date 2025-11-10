"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Users, Music, ThumbsUp, Radio, UserCheck, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

type Jam = {
  id: string;
  name: string;
  host: string;
  private: boolean;
  max_participants: number;
  created_at: string;
};

function JamPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const action = searchParams.get("action");
  const [joinCode, setJoinCode] = useState("");
  const [participantName, setParticipantName] = useState("");

  // Create session form state
  const [jamName, setJamName] = useState("");
  const [hostName, setHostName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [allowVoting, setAllowVoting] = useState(true);
  const [allowRequests, setAllowRequests] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Rejoin session state
  const [isRejoinMode, setIsRejoinMode] = useState(false);
  const [rejoinId, setRejoinId] = useState("");
  const [isRejoining, setIsRejoining] = useState(false);
  const [rejoinError, setRejoinError] = useState<string | null>(null);

  // Join session state
  const [availableJams, setAvailableJams] = useState<Jam[]>([]);
  const [loadingJams, setLoadingJams] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Fetch available jams when on join page
  useEffect(() => {
    if (action === "join") {
      fetchAvailableJams();
    }
  }, [action]);

  const fetchAvailableJams = async () => {
    setLoadingJams(true);
    try {
      const { data, error } = await supabase
        .from("jams")
        .select("id, name, host, private, max_participants, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setAvailableJams(data || []);
    } catch (error) {
      console.error("Failed to fetch jams:", error);
    } finally {
      setLoadingJams(false);
    }
  };

  const handleJoinSession = async (jamId?: string, isPrivateJam?: boolean) => {
    const sessionId = jamId || joinCode.trim();
    const cleanName = participantName.trim();

    if (!sessionId || !cleanName || joining) return;

    if (isPrivateJam) {
      setPendingRequest(sessionId);
      return;
    }

    setJoining(true);
    setJoinError(null);

    try {
      const { data: existingParticipant, error: fetchError } = await supabase
        .from("participants")
        .select("id")
        .eq("jam_id", sessionId)
        .ilike("name", cleanName)
        .maybeSingle();

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError;
      }

      if (existingParticipant?.id) {
        router.push(`/jam/${sessionId}/participant/${existingParticipant.id}`);
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("participants")
        .insert({
          jam_id: sessionId,
          name: cleanName,
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      router.push(`/jam/${sessionId}/participant/${inserted.id}`);
    } catch (error) {
      console.error("Failed to join session:", error);
      setJoinError("Could not join the session. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleCancelRequest = () => {
    setPendingRequest(null);
    // TODO: Cancel join request in backend
  };

  const handleRejoinSession = async () => {
    if (!rejoinId.trim() || isRejoining) {
      return;
    }

    setIsRejoining(true);
    setRejoinError(null);

    try {
      // Check if jam exists in database
      const { data, error } = await supabase
        .from("jams")
        .select("id")
        .eq("id", rejoinId.trim())
        .single();

      if (error || !data) {
        setRejoinError("Jam session not found. Please check the ID and try again.");
        return;
      }

      // Redirect to host page
      router.push(`/jam/${rejoinId.trim()}/host`);
    } catch (error) {
      console.error("Failed to rejoin session:", error);
      setRejoinError("Unable to rejoin session. Please try again.");
    } finally {
      setIsRejoining(false);
    }
  };

  const handleCreateSession = async () => {
    if (!jamName.trim() || !hostName.trim() || isCreating) {
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const { data, error } = await supabase
        .from("jams")
        .insert({
          name: jamName.trim(),
          host: hostName.trim(),
          voting: allowVoting,
          requests: allowRequests,
          max_participants: maxParticipants,
          private: isPrivate,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      if (data?.id) {
        router.push(`/jam/${data.id}/host`);
      } else {
        setCreateError("Jam session created but no session ID was returned.");
      }
    } catch (error) {
      console.error("Failed to create jam session:", error);
      setCreateError("Unable to create jam session. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black font-sans">
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

      {/* Main content */}
      <main className="relative z-10 w-full max-w-2xl px-6 py-12">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => router.push("/")}
          className="mb-8 flex items-center gap-2 rounded-xl border border-white/5 bg-linear-to-br from-white/5 via-black/70 to-white/5 px-4 py-2 text-white/60 backdrop-blur-xl transition-all hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={18} />
          Back to Home
        </motion.button>

        {/* Content based on action */}
        {action === "create" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          className="flex max-h-[90vh] flex-col rounded-3xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur-xl"
          >
            <div className="shrink-0 p-8 pb-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-linear-to-br from-purple-500/20 to-blue-500/20 p-3 backdrop-blur-sm">
                    <Plus className="text-purple-400" size={28} />
                  </div>
                  <h1 className="text-3xl font-bold text-white">
                    {isRejoinMode ? "Rejoin Jam Session" : "Create Jam Session"}
                  </h1>
                </div>
                <motion.button
                  onClick={() => {
                    setIsRejoinMode(!isRejoinMode);
                    setCreateError(null);
                    setRejoinError(null);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative overflow-hidden rounded-xl bg-linear-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50"
                >
                  <motion.div
                    className="absolute inset-0 bg-linear-to-r from-purple-500 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100"
                    initial={false}
                  />
                  <span className="relative">
                    {isRejoinMode ? "Create New" : "Rejoin"}
                  </span>
                </motion.button>
              </div>

              <p className="text-zinc-400">
                {isRejoinMode
                  ? "Enter your jam session ID to rejoin as host."
                  : "Start a new collaborative jam session. Configure your settings and invite others to join."}
              </p>
            </div>

            <div className="scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-purple-500/50 flex-1 overflow-y-auto px-8 py-6">

            {isRejoinMode ? (
              /* Rejoin Mode - Just Jam ID Input */
              <div className="mb-8">
                <label className="mb-2 block text-sm font-medium text-white/80">
                  Jam Session ID
                </label>
                <input
                  type="text"
                  value={rejoinId}
                  onChange={(e) => setRejoinId(e.target.value)}
                  placeholder="Enter your jam session ID"
                  className="w-full rounded-xl border border-purple-500/40 bg-black px-4 py-3.5 text-white placeholder-zinc-500 backdrop-blur-xl transition-all focus:border-purple-500/50 focus:bg-black focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <p className="mt-2 text-sm text-white/50">
                  Enter the ID of the jam session you want to rejoin as host
                </p>
              </div>
            ) : (
              <>
            {/* Session Details */}
            <div className="mb-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">
                  Jam Session Name
                </label>
                <input
                  type="text"
                  value={jamName}
                  onChange={(e) => setJamName(e.target.value)}
                  placeholder="Enter a name for your jam session"
                  className="w-full rounded-xl border border-purple-500/40 bg-black px-4 py-3.5 text-white placeholder-zinc-500 backdrop-blur-xl transition-all focus:border-purple-500/50 focus:bg-black focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/80">Host Name</label>
                <input
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-xl border border-blue-500/40 bg-black px-4 py-3.5 text-white placeholder-zinc-500 backdrop-blur-xl transition-all focus:border-blue-500/50 focus:bg-black focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            {/* Session Settings */}
            <div className="mb-8 space-y-6 rounded-2xl bg-linear-to-br from-white/5 via-black/70 to-white/5 p-6 backdrop-blur-md">
              <h3 className="text-lg font-semibold text-white">Session Settings</h3>

              {/* Max Participants */}
              <div className="space-y-2 ">
                <label className="block text-sm font-medium text-white/80">
                  Max Participants
                </label>
                <input
                  type="number"
                  min={2}
                  step={1}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="w-full rounded-xl border border-purple-500/40 bg-black/90 px-4 py-3 text-white placeholder-zinc-500 backdrop-blur-xl transition-all focus:border-purple-500/50 focus:bg-black focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  placeholder="Enter max participants"
                />
              </div>

              {/* Toggle Settings */}
              <div className="grid grid-cols-2 gap-3 pt-5">
                {/* Allow Voting */}
                <motion.button
                  onClick={() => setAllowVoting(!allowVoting)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all ${
                    allowVoting
                      ? "border-purple-500 bg-purple-600 shadow-[0_0_30px_rgba(168,85,247,0.6)]"
                      : "border-white/10 bg-purple-500/10"
                  }`}
                >
                  <div
                    className={`rounded-xl p-3 transition-all ${
                      allowVoting ? "bg-purple-500/40" : "bg-purple-500/5"
                    }`}
                  >
                    <ThumbsUp
                      className={allowVoting ? "text-white" : "text-purple-500/40"}
                      size={24}
                    />
                  </div>
                  <div className="text-center">
                    <p
                      className={`text-sm font-medium ${
                        allowVoting ? "text-white" : "text-white/40"
                      }`}
                    >
                      Allow Voting
                    </p>
                  </div>
                </motion.button>

                {/* Allow Requests */}
                <motion.button
                  onClick={() => setAllowRequests(!allowRequests)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all ${
                    allowRequests
                      ? "border-blue-500 bg-blue-600 shadow-[0_0_30px_rgba(59,130,246,0.6)]"
                      : "border-white/10 bg-blue-500/10"
                  }`}
                >
                  <div
                    className={`rounded-xl p-3 transition-all ${
                      allowRequests ? "bg-blue-500/40" : "bg-blue-500/5"
                    }`}
                  >
                    <Radio
                      className={allowRequests ? "text-white" : "text-blue-500/40"}
                      size={24}
                    />
                  </div>
                  <div className="text-center">
                    <p
                      className={`text-sm font-medium ${
                        allowRequests ? "text-white" : "text-white/40"
                      }`}
                    >
                      Allow Requests
                    </p>
                  </div>
                </motion.button>

                {/* Require Approval */}
                <motion.button
                  onClick={() => setRequireApproval(!requireApproval)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all ${
                    requireApproval
                      ? "border-green-500 bg-green-600 shadow-[0_0_30px_rgba(34,197,94,0.6)]"
                      : "border-white/10 bg-green-500/10"
                  }`}
                >
                  <div
                    className={`rounded-xl p-3 transition-all ${
                      requireApproval ? "bg-green-500/40" : "bg-green-500/5"
                    }`}
                  >
                    <UserCheck
                      className={requireApproval ? "text-white" : "text-green-500/40"}
                      size={24}
                    />
                  </div>
                  <div className="text-center">
                    <p
                      className={`text-sm font-medium ${
                        requireApproval ? "text-white" : "text-white/40"
                      }`}
                    >
                      Require Approval
                    </p>
                  </div>
                </motion.button>

                {/* Set Jam Private */}
                <motion.button
                  onClick={() => setIsPrivate(!isPrivate)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all ${
                    isPrivate
                      ? "border-orange-500 bg-orange-600 shadow-[0_0_30px_rgba(249,115,22,0.6)]"
                      : "border-white/10 bg-orange-500/10"
                  }`}
                >
                  <div
                    className={`rounded-xl p-3 transition-all ${
                      isPrivate ? "bg-orange-500/40" : "bg-orange-500/5"
                    }`}
                  >
                    <Lock
                      className={isPrivate ? "text-white" : "text-orange-500/40"}
                      size={24}
                    />
                  </div>
                  <div className="text-center">
                    <p
                      className={`text-sm font-medium ${
                        isPrivate ? "text-white" : "text-white/40"
                      }`}
                    >
                      Set Jam Private
                    </p>
                  </div>
                </motion.button>
              </div>
            </div>
            </>
            )}
            </div>

            {/* Action Button - Fixed at bottom */}
            <div className="shrink-0 p-8 pt-6">
              {isRejoinMode ? (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRejoinSession}
                    disabled={!rejoinId.trim() || isRejoining}
                    className="group relative w-full overflow-hidden rounded-2xl bg-linear-to-r from-purple-600 to-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-2xl shadow-purple-500/30 transition-all hover:shadow-purple-500/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    <motion.div
                      className="absolute inset-0 bg-linear-to-r from-purple-500 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100"
                      initial={false}
                    />
                    <span className="relative flex items-center justify-center gap-2">
                      {isRejoining ? "Rejoining Session..." : "Rejoin as Host"}
                    </span>
                  </motion.button>
                  {rejoinError && (
                    <p className="mt-4 text-sm text-red-400">
                      {rejoinError}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateSession}
                    disabled={!jamName.trim() || !hostName.trim() || isCreating}
                    className="group relative w-full overflow-hidden rounded-2xl bg-linear-to-r from-purple-600 to-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-2xl shadow-purple-500/30 transition-all hover:shadow-purple-500/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    <motion.div
                      className="absolute inset-0 bg-linear-to-r from-purple-500 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100"
                      initial={false}
                    />
                    <span className="relative flex items-center justify-center gap-2">
                      {isCreating ? "Creating Session..." : "Start Session as Host"}
                    </span>
                  </motion.button>
                  {createError && (
                    <p className="mt-4 text-sm text-red-400">
                      {createError}
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        ) : action === "join" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex max-h-[90vh] flex-col rounded-3xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur-xl"
          >
            <div className="shrink-0 p-8 pb-6">
              <div className="mb-4 flex items-center gap-4">
                <div className="rounded-2xl bg-linear-to-br from-blue-500/20 to-purple-500/20 p-3 backdrop-blur-sm">
                  <Users className="text-blue-400" size={28} />
                </div>
                <h1 className="text-3xl font-bold text-white">Join Jam Session</h1>
              </div>

              <p className="text-zinc-400">
                Enter the session ID provided by the host to join their jam session.
              </p>
            </div>

            <div className="scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-blue-500/50 flex-1 overflow-y-auto px-8 py-6">

            {/* Join Code Input */}
            <div className="mb-8">
                <label className="mb-2 block text-sm font-medium text-white/80">
                  Session ID
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Enter session ID"
                  className="w-full rounded-xl border border-blue-500/40 bg-black px-4 py-3.5 font-mono text-lg text-white placeholder-zinc-500 backdrop-blur-xl transition-all focus:border-blue-500/50 focus:bg-black focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <p className="mt-2 text-sm text-white/50">
                  Ask the host for their session ID to join
                </p>
              </div>

              <div className="mb-8">
                <label className="mb-2 block text-sm font-medium text-white/80">
                  Your Name
                </label>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-xl border border-blue-500/40 bg-black px-4 py-3.5 text-white placeholder-zinc-500 backdrop-blur-xl transition-all focus:border-blue-500/50 focus:bg-black focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <p className="mt-2 text-sm text-white/50">
                  This is how you&apos;ll appear to the host and other participants
                </p>
            </div>

            {/* Available Jams */}
            <div className="mb-8 space-y-4 rounded-2xl bg-linear-to-br from-white/5 via-black/70 to-white/5 p-6 backdrop-blur-md">
              <h3 className="text-lg font-semibold text-white">Available Jams</h3>

              {loadingJams ? (
                <div className="py-8 text-center text-white/50">Loading jams...</div>
              ) : availableJams.length === 0 ? (
                <div className="py-8 text-center text-white/50">No available jams at the moment</div>
              ) : (
                <div className="space-y-3">
                  {availableJams.map((jam) => (
                    <div
                      key={jam.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/50 p-4 backdrop-blur-sm transition-all hover:bg-black/70"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${jam.private ? "bg-orange-500/20" : "bg-blue-500/20"}`}>
                          {jam.private ? (
                            <Lock className="text-orange-400" size={18} />
                          ) : (
                            <Music className="text-blue-400" size={18} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{jam.name}</p>
                          <p className="text-xs text-white/50">
                            Host: {jam.host} • Max: {jam.max_participants}
                          </p>
                        </div>
                      </div>
              {pendingRequest === jam.id ? (
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg bg-yellow-500/20 px-3 py-1.5 text-xs font-medium text-yellow-400">
                            Request Pending
                          </div>
                          <button
                            onClick={handleCancelRequest}
                            className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:bg-red-500/30"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                        onClick={() => handleJoinSession(jam.id, jam.private)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                            jam.private
                              ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                              : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                          }`}
                        >
                          Join
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>

            {/* Join Button - Fixed at bottom */}
            <div className="shrink-0 p-8 pt-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleJoinSession()}
                disabled={!joinCode.trim() || !participantName.trim() || joining}
                className="group relative w-full overflow-hidden rounded-2xl bg-linear-to-r from-blue-600 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-2xl shadow-blue-500/30 transition-all hover:shadow-blue-500/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                <motion.div
                  className="absolute inset-0 bg-linear-to-r from-blue-500 to-purple-500 opacity-0 transition-opacity group-hover:opacity-100"
                  initial={false}
                />
                <span className="relative flex items-center justify-center gap-2">
                  {joining ? "Joining..." : "Join Session as Participant"}
                </span>
              </motion.button>
              {joinError && (
                <p className="mt-4 text-sm text-red-400">
                  {joinError}
                </p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-white/10 bg-black/40 p-8 text-center shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-8 flex justify-center">
              <div className="rounded-2xl bg-linear-to-br from-purple-500/20 to-blue-500/20 p-5 backdrop-blur-sm">
                <Music className="text-purple-400" size={36} />
              </div>
            </div>
            <h1 className="mb-4 text-3xl font-bold text-white">Jam Session</h1>
            <p className="mb-8 text-zinc-400">
              Please select an action to continue. Would you like to create a new session or join
              an existing one?
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/jam?action=create")}
                className="group relative flex-1 overflow-hidden rounded-2xl bg-linear-to-r from-purple-600 to-blue-600 px-6 py-3 font-semibold text-white shadow-2xl shadow-purple-500/30 transition-all hover:shadow-purple-500/50"
              >
                <motion.div
                  className="absolute inset-0 bg-linear-to-r from-purple-500 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100"
                  initial={false}
                />
                <span className="relative">Create Session</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/jam?action=join")}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white backdrop-blur-xl transition-all hover:bg-white/10"
              >
                Join Session
              </motion.button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default function JamPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          Loading jam experience...
        </div>
      }
    >
      <JamPageContent />
    </Suspense>
  );
}
