"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, LogIn } from "lucide-react";
import { useMemo } from "react";


function createSeededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

type Particle = {
  initialX: number;
  initialY: number;
  targetX: number;
  targetY: number;
  duration: number;
};

export default function Home() {
  const { width, height } = useMemo(() => {
    if (typeof window !== "undefined") {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return { width: 1920, height: 1080 };
  }, []);

  const particles = useMemo<Particle[]>(() => {
    const random = createSeededRandom(123456);

    return Array.from({ length: 60 }, () => ({
      initialX: random() * width,
      initialY: random() * height,
      targetX: random() * width,
      targetY: random() * height,
      duration: random() * 10  + 10,
    }));
  }, [height, width]);

  const waveHeights = useMemo<number[]>(() => {
    const random = createSeededRandom(654321);
    return Array.from({ length: 11 }, () => random() * 40 + 20);
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black font-sans">
      {/* Animated grid background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }} />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-purple-500"
            initial={{
              x: particle.initialX,
              y: particle.initialY,
            }}
            animate={{
              x: particle.targetX,
              y: particle.targetY,
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-6">
          <h1 className="font-[family-name:var(--font-orbitron)] text-7xl font-bold tracking-tight text-white md:text-8xl lg:text-9xl">
            Resonance
          </h1>
          <div className="mx-auto mt-4 h-1 w-3/5 rounded-full bg-linear-to-r from-purple-600 via-blue-600 to-purple-600" />
        </div>

        <div className="mb-12 max-w-2xl">
        
          <p className="text-lg text-zinc-400 md:text-xl">
            Create or join collaborative jam sessions in real-time. Connect with musicians
            and create something amazing together.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Create Session Button */}
          <Link href="/jam">
            <motion.button
              className="group relative overflow-hidden rounded-full bg-linear-to-r from-purple-600 to-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all"
              whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(139, 92, 246, 0.4)" }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <motion.span
                className="absolute inset-0 bg-linear-to-r from-purple-700 to-blue-700"
                initial={{ x: "-100%" }}
                whileHover={{ x: "0%" }}
                transition={{ duration: 0.3 }}
              />
              <span className="relative flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 90, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Plus size={20} />
                </motion.div>
                Create a jam session
              </span>
            </motion.button>
          </Link>

          {/* Join Session Button */}
          <Link href="/jam">
            <motion.button
              className="group relative overflow-hidden rounded-full border-2 border-zinc-700 bg-zinc-900/50 px-8 py-4 text-lg font-semibold text-white backdrop-blur-sm transition-all hover:border-purple-500"
              whileHover={{ scale: 1.02, borderColor: "rgb(168, 85, 247)" }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <motion.span
                className="absolute inset-0 bg-linear-to-r from-purple-600/20 to-blue-600/20"
                initial={{ x: "-100%" }}
                whileHover={{ x: "0%" }}
                transition={{ duration: 0.3 }}
              />
              <span className="relative flex items-center gap-2">
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <LogIn size={20} />
                </motion.div>
                Join a jam session
              </span>
            </motion.button>
          </Link>
        </div>

        {/* Feature tags */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {["Low Latency", "Real-time Sync", "High Quality Jamming"].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-400 backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Decorative sound wave animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-16 flex items-end justify-center gap-1"
        >
          {waveHeights.map((height, i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full bg-linear-to-t from-purple-600 to-blue-600"
              animate={{
                height: [20, height, 20],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.08,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>
      </main>
    </div>
  );
}
