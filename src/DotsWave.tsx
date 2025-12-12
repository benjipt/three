import { useRef, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DotsWaveProps {
  spacing?: number;
}

function DotsGrid({ spacing = 0.6 }: DotsWaveProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const { viewport } = useThree();

  const { geometry, gridWidth, gridHeight } = useMemo(() => {
    const positions: number[] = [];

    // Calculate grid dimensions based on viewport, with extra padding to hide edges
    const padding = 30; // Extra dots beyond viewport edges to hide wave boundaries
    const width = Math.ceil(viewport.width / spacing) + padding * 2;
    // Grid height: make visible column spacing be 5% of viewport height
    const visibleGridHeight = viewport.height * 0.05;
    const height = Math.ceil(visibleGridHeight / spacing) + padding * 2;

    // Create a grid of points
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const posX = (x - width / 2) * spacing;
        const posY = (y - height / 2) * spacing;
        const posZ = 0;

        positions.push(posX, posY, posZ);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(positions), 3)
    );

    return { geometry: geom, gridWidth: width, gridHeight: height };
  }, [viewport.width, viewport.height, spacing]);

  // Animate the wave
  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    const time = clock.getElapsedTime();
    // Envelope Boids
    // A fixed-speed left-to-right carrier whose local amplitude is shaped
    // by a set of moving envelopes (“boids”) that fly in lanes across X,
    // influencing nearby points with smooth falloff. Displacement is z-only.
    const speed = 0.8; // consistent LR speed
    const baseAmp = 8.6; // overall vertical displacement scale
    const carrierFreq = 0.16; // spatial frequency along X

    // Boid lanes (Y positions) and initial phases
    const lanes = [-6.0, -2.0, 2.0, 6.0];
    const lanePhase = lanes.map((_, i) => i * 0.7);

    // Each boid moves left-to-right with slight lane wiggle
    const boidCountPerLane = 3;
    const boidSpacingX = 20.0; // separation along X
    const boidInfluenceSigmaX = 5.5; // horizontal falloff
    const boidInfluenceSigmaY = 1.6; // vertical falloff
    const boidAmp = 0.8; // how strongly a boid boosts local amplitude

    // Small global drift to avoid stationary repetition
    const drift = Math.sin(time * 0.05) * 4.0;

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const index = (y * gridWidth + x) * 3;

        const posX = positions[index];
        const posY = positions[index + 1];
        // Base carrier wave (LR motion)
        const phase = posX * carrierFreq - time * speed;
        let localAmp = baseAmp * 0.6; // baseline amplitude everywhere

        // Aggregate influence from boids across all lanes
        for (let li = 0; li < lanes.length; li++) {
          const laneY = lanes[li] + Math.sin(time * 0.25 + lanePhase[li]) * 0.8; // gentle wiggle
          for (let bi = 0; bi < boidCountPerLane; bi++) {
            // Boid X center moves LR with spacing; stagger with lane index and bi
            const boidCenterX = -40 + drift + (bi * boidSpacingX) + time * (speed * 12) + li * 3.0;
            const dx = posX - boidCenterX;
            const dy = posY - laneY;
            const gx = Math.exp(-(dx * dx) / (2 * boidInfluenceSigmaX * boidInfluenceSigmaX));
            const gy = Math.exp(-(dy * dy) / (2 * boidInfluenceSigmaY * boidInfluenceSigmaY));
            const influence = gx * gy; // elliptical Gaussian envelope
            localAmp += baseAmp * boidAmp * influence;
          }
        }

        // Final vertical displacement: carrier modulated by envelope boids
        positions[index + 2] = Math.sin(phase) * localAmp;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial color="#DC6AA3" size={0.1} sizeAttenuation={false} />
    </points>
  );
}

export function DotsWave() {
  return (
    <Canvas
      camera={{ position: [0, 40, 10], far: 1000 }}
      style={{ width: '100%', height: '100%' }}>
      <DotsGrid spacing={0.5} />
    </Canvas>
  );
}
