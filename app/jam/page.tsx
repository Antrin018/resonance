"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Users, Copy, Check, Music } from "lucide-react";
import { useState } from "react";

export default function JamPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const action = searchParams.get("action");
  const [copied, setCopied] = useState(false);
  const [sessionId, setSessionId] = useState("JAM-" + Math.random().toString(36).substr(2, 9).toUpperCase());
  const [joinCode, setJoinCode] = useState("");

  const handleCopySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinSession = () => {
    if (joinCode.trim()) {
      // Navigate to the session
      router.push(`/jam/${joinCode.trim()}/participant`);
    }
  };

  const handleCreateSession = () => {
    // Navigate to the host page
    router.push(`/jam/${sessionId}/host`);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black font-sans">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-1/2 -left-1/4 h-[500px] w-[500px] rounded-full bg-purple-600/20 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
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
          className="mb-8 flex items-center gap-2 text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={20} />
          Back to Home
        </motion.button>

        {/* Content based on action */}
        {action === "create" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-full bg-purple-600/20 p-3">
                <Plus className="text-purple-400" size={24} />
              </div>
              <h1 className="text-3xl font-bold text-white">Create Jam Session</h1>
            </div>

            <p className="mb-8 text-zinc-400">
              Start a new collaborative jam session. Share the session ID with others to let them
              join.
            </p>

            {/* Session ID Display */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Your Session ID
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 font-mono text-lg text-white">
                  {sessionId}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopySessionId}
                  className="rounded-lg bg-zinc-800 p-3 transition-colors hover:bg-zinc-700"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="text-green-400" size={20} />
                  ) : (
                    <Copy className="text-zinc-400" size={20} />
                  )}
                </motion.button>
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                Share this ID with participants to let them join your session
              </p>
            </div>

            {/* Session Settings Preview */}
            <div className="mb-8 space-y-4 rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
              <h3 className="font-semibold text-white">Session Settings</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Max Participants</span>
                  <span className="text-white">8 users</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Audio Quality</span>
                  <span className="text-white">High (320kbps)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Latency Mode</span>
                  <span className="text-white">Ultra Low</span>
                </div>
              </div>
            </div>

            {/* Create Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreateSession}
              className="w-full rounded-full bg-linear-to-r from-purple-600 to-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:shadow-purple-500/50"
            >
              Start Session as Host
            </motion.button>
          </motion.div>
        ) : action === "join" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-full bg-blue-600/20 p-3">
                <Users className="text-blue-400" size={24} />
              </div>
              <h1 className="text-3xl font-bold text-white">Join Jam Session</h1>
            </div>

            <p className="mb-8 text-zinc-400">
              Enter the session ID provided by the host to join their jam session.
            </p>

            {/* Join Code Input */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-zinc-300">Session ID</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="JAM-XXXXXXXXX"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 font-mono text-lg text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <p className="mt-2 text-sm text-zinc-500">
                Ask the host for their session ID to join
              </p>
            </div>

            {/* Recent Sessions Preview */}
            <div className="mb-8 space-y-3 rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
              <h3 className="font-semibold text-white">Recent Sessions</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-700/50">
                  <div className="flex items-center gap-3">
                    <Music className="text-purple-400" size={18} />
                    <div>
                      <p className="text-sm font-medium text-white">JAM-ABC123XYZ</p>
                      <p className="text-xs text-zinc-500">2 hours ago</p>
                    </div>
                  </div>
                  <button className="text-xs text-purple-400 hover:text-purple-300">
                    Rejoin
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-md bg-zinc-800/50 p-3 transition-colors hover:bg-zinc-700/50">
                  <div className="flex items-center gap-3">
                    <Music className="text-purple-400" size={18} />
                    <div>
                      <p className="text-sm font-medium text-white">JAM-DEF456ABC</p>
                      <p className="text-xs text-zinc-500">Yesterday</p>
                    </div>
                  </div>
                  <button className="text-xs text-purple-400 hover:text-purple-300">
                    Rejoin
                  </button>
                </div>
              </div>
            </div>

            {/* Join Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleJoinSession}
              disabled={!joinCode.trim()}
              className="w-full rounded-full bg-linear-to-r from-blue-600 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:shadow-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Join Session as Participant
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center backdrop-blur-sm"
          >
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-zinc-800 p-4">
                <Music className="text-zinc-400" size={32} />
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
                className="flex-1 rounded-full bg-linear-to-r from-purple-600 to-blue-600 px-6 py-3 font-semibold text-white"
              >
                Create Session
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/jam?action=join")}
                className="flex-1 rounded-full border-2 border-zinc-700 bg-zinc-900/50 px-6 py-3 font-semibold text-white backdrop-blur-sm"
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
