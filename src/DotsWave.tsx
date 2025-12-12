import { useRef, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DotsWaveProps {
  spacing?: number;
}

function DotsGrid({ spacing = 0.5 }: DotsWaveProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const { viewport } = useThree();

  const { geometry, gridWidth, gridHeight } = useMemo(() => {
    const positions: number[] = [];

    // Calculate grid dimensions based on viewport, with extra padding to hide edges
    const padding = 20; // Extra dots beyond viewport edges to hide wave boundaries
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

    // Base wave parameters (seamless, fluid loop)
    const baseSpeed = 1.2; // fixed, consistent speed
    const baseAmplitude = 3.5;

    // Smoothly time-varying parameters (LFOs) to add organic variation
    // These are continuous functions of time, so there are no hard transitions.
    const lfo1 = 0.5 + 0.5 * Math.sin(time * 0.15); // 0..1
    const lfo2 = 0.5 + 0.5 * Math.cos(time * 0.11); // 0..1
    const lfo3 = 0.5 + 0.5 * Math.sin(time * 0.07 + 1.3); // 0..1
    const lfoY = 0.5 + 0.5 * Math.sin(time * 0.09 + 0.8); // vertical sweep modulator

    // Modulated parameters derived from LFOs
    const freqA = 0.12 + lfo1 * 0.12; // varies ~0.12..0.24
    const freqB = 0.22 + lfo2 * 0.10; // varies ~0.22..0.32
    const freqC = 0.08 + lfo3 * 0.08; // varies ~0.08..0.16
    const speed = baseSpeed; // no speed modulation; maintain consistency
    const ampA = baseAmplitude * (1.1 + lfo1 * 0.5);
    const ampB = baseAmplitude * (0.7 + lfo3 * 0.4);
    const ampC = baseAmplitude * (0.5 + lfo2 * 0.5);

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const index = (y * gridWidth + x) * 3;

        const posX = positions[index];
        const posY = positions[index + 1];

        // Single continuous waveform composed of three time-modulated components
        // Three concurrent left-to-right waves with distinct dynamics (fixed speed)
        const wA = Math.sin(posX * freqA - time * speed + 0.0) * ampA;
        const wB = Math.sin(posX * freqB - time * speed + 1.3) * ampB; // phase offset
        const wC = Math.sin(posX * freqC - time * speed + 2.1) * ampC; // straight fronts

        // Add top-to-bottom folding via independent vertical sweeps (different speeds)
        const vFreq1 = 0.45 + lfoY * 0.25;  // vertical band spacing
        const vFreq2 = 0.22 + lfo2 * 0.18;  // secondary vertical banding
        const vSpeed1 = 0.65;               // slower than left-to-right
        const vSpeed2 = 0.95;               // closer to LR but still distinct
        const vAmp1 = baseAmplitude * (0.45 + lfo1 * 0.30);
        const vAmp2 = baseAmplitude * (0.35 + lfo3 * 0.25);
        const wV1 = Math.sin(posY * vFreq1 - time * vSpeed1) * vAmp1;
        const wV2 = Math.sin(posY * vFreq2 - time * vSpeed2 + 0.9) * vAmp2;

        // Subtle position-based variation for extra depth; keeps continuity
        const positionVariation = Math.sin(posX * 0.6 + posY * 0.3) * baseAmplitude * 0.12;

        // Combine LR waves and vertical folds; displacement along z only
        positions[index + 2] = wA + wB + wC + wV1 + wV2 + positionVariation;
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
      camera={{ position: [0, 0, 30], far: 1000 }}
      style={{ width: '100%', height: '100%' }}>
      <DotsGrid spacing={0.5} />
    </Canvas>
  );
}
