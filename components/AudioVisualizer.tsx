"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function Particles({ isPlaying }: { isPlaying: boolean }) {
  const count = 2000;
  const mesh = useRef<THREE.Points>(null!);
  
  const particles = useMemo(() => {
    const temp = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = THREE.MathUtils.randFloatSpread(360);
      const phi = THREE.MathUtils.randFloatSpread(360);
      
      const x = 20 * Math.sin(theta) * Math.cos(phi);
      const y = 20 * Math.sin(theta) * Math.sin(phi);
      const z = 20 * Math.cos(theta);
      
      temp[i * 3] = x;
      temp[i * 3 + 1] = y;
      temp[i * 3 + 2] = z;
    }
    return temp;
  }, [count]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const speed = isPlaying ? 0.5 : 0.1;
    
    mesh.current.rotation.y = time * speed;
    mesh.current.rotation.x = time * (speed * 0.5);
    
    // Pulse effect
    const scale = isPlaying 
      ? 1 + Math.sin(time * 4) * 0.1 
      : 1 + Math.sin(time) * 0.05;
      
    mesh.current.scale.set(scale, scale, scale);
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length / 3}
          args={[particles, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.3}
        color={isPlaying ? "#a855f7" : "#4b5563"} // Purple when playing, Gray when idle
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
}

export default function AudioVisualizer({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 50], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Particles isPlaying={isPlaying} />
      </Canvas>
    </div>
  );
}
