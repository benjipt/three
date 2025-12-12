import { useRef, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Deterministic pseudo-random hash function (stable per boid)
function hashBoid(laneIdx: number, boidIdx: number): number {
  const seed = laneIdx * 73856093 ^ boidIdx * 19349663;
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x); // returns 0-1
}

interface DotsWaveProps {
  spacing?: number;
  baseOpacity?: number;
  brightness?: number;
}

function DotsGrid({ spacing = 0.6, baseOpacity = 0.85, brightness = 0.9 }: DotsWaveProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport, gl } = useThree();

  const { geometry, gridWidth, gridHeight } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];

    const baseR = 220 / 255;
    const baseG = 106 / 255;
    const baseB = 163 / 255;

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
        colors.push(baseR, baseG, baseB);
        sizes.push(1.4); // initial pixel size per point
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geom.setAttribute('size', new THREE.BufferAttribute(new Float32Array(sizes), 1));

    return { geometry: geom, gridWidth: width, gridHeight: height };
  }, [viewport.width, viewport.height, spacing]);

  // Animate the wave
  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    const colors =
      (pointsRef.current.geometry.attributes.color?.array as Float32Array) ?? null;
    const sizes =
      (pointsRef.current.geometry.attributes.size?.array as Float32Array) ?? null;
    const time = clock.getElapsedTime();
    // Envelope Boids
    // A fixed-speed left-to-right carrier whose local amplitude is shaped
    // by a set of moving envelopes ("boids") that fly in lanes across X,
    // influencing nearby points with smooth falloff. Displacement is z-only.
    const speed = 1.0; // consistent LR speed
    const baseAmp = 3.6; // overall vertical displacement scale
    const carrierFreq = 0.16; // spatial frequency along X

    // Boid lanes (Y positions) and initial phases
    const lanes = [-6.0, -2.0, 2.0, 6.0];
    const lanePhase = lanes.map((_, i) => i * 3.6);

    // Each boid moves left-to-right with slight lane wiggle
    const boidCountPerLane = 3;
    const boidSpacingX = 20.0; // separation along X
    const boidInfluenceSigmaX = 5.5; // horizontal falloff
    const boidInfluenceSigmaY = 1.6; // vertical falloff
    const boidAmp = 0.8; // how strongly a boid boosts local amplitude

    // Small global drift to avoid stationary repetition
    const drift = Math.sin(time * 0.05) * 4.0;

    // Ramp up boid influence gradually over first 2 seconds to avoid startup burst
    const boidRampTime = 2.0;
    const boidRamp = Math.min(1.0, time / boidRampTime);

    // Crest color burn + Depth fog band variables
    const accent = [1.0, 0.65, 0.18]; // warm accent (orange)
    const fogColor = [0.06, 0.04, 0.03]; // dark fog tint
    const burnThreshold = baseAmp * 0.35; // displacement at which accent begins
    const burnRange = baseAmp * 0.9; // span of accent ramp
    // Make fog subtle: only at extreme peaks, with gentle curve
    const fogStart = baseAmp * 0.85; // later start -> fewer points receive fog
    const fogRange = baseAmp * 0.6; // narrower range -> quicker falloff

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
            // Deterministic random properties per boid
            const boidHash = hashBoid(li, bi);
            const boidSpeedVar = 0.8 + boidHash * 0.4; // speed varies 0.8x to 1.2x
            const boidPhaseOffset = boidHash * Math.PI * 2; // random phase offset for re-entry timing
            const boidSigmaVar = 0.7 + boidHash * 0.6; // shape varies 0.7x to 1.3x
            
            // Boid X center moves LR with variable speed and phase offset for varied timing
            let boidCenterX = -40 + drift + (bi * boidSpacingX) + time * (speed * 12 * boidSpeedVar) + li * 3.0 + boidPhaseOffset;
            // Wrap boids horizontally so they loop continuously (viewport width ~80)
            boidCenterX = boidCenterX % 160 - 80; // Wrap within visible range
            const dx = posX - boidCenterX;
            const dy = posY - laneY;
            const gx = Math.exp(-(dx * dx) / (2 * boidInfluenceSigmaX * boidInfluenceSigmaX * boidSigmaVar));
            const gy = Math.exp(-(dy * dy) / (2 * boidInfluenceSigmaY * boidInfluenceSigmaY * boidSigmaVar));
            const influence = gx * gy; // elliptical Gaussian envelope with variable shape
            localAmp += baseAmp * boidAmp * influence * boidRamp; // Apply ramp-in factor
          }
        }

        // Final vertical displacement: carrier modulated by envelope boids
        const disp = Math.sin(phase) * localAmp;
        positions[index + 2] = disp;

        if (colors) {
          // Crest mask (smoothstep-like)
          const absD = Math.abs(disp);
          const crest = Math.max(0, Math.min(1, (absD - burnThreshold) / burnRange));
          // interpolate base -> accent based on crest
          const baseR = 220 / 255;
          const baseG = 106 / 255;
          const baseB = 163 / 255;
          let r = baseR * (1 - crest) + accent[0] * crest;
          let g = baseG * (1 - crest) + accent[1] * crest;
          let b = baseB * (1 - crest) + accent[2] * crest;

          // Subtle fog band at extreme crests only
          let fogFactor = Math.max(0, Math.min(1, (absD - fogStart) / fogRange));
          // Ease-in curve and cap intensity to keep it subtle
          fogFactor = Math.pow(fogFactor, 1.5) * 0.35; // max ~35% blend
          r = r * (1.0 - fogFactor) + fogColor[0] * fogFactor;
          g = g * (1.0 - fogFactor) + fogColor[1] * fogFactor;
          b = b * (1.0 - fogFactor) + fogColor[2] * fogFactor;

          colors[index] = r;
          colors[index + 1] = g;
          colors[index + 2] = b;
        }

        if (sizes) {
          // Make subtle size modulation based on crest (bigger for crests)
          const basePixel = 1.2; // baseline pixel size
          const sizeBoost = 1.8; // maximum extra multiplier for crests
          const absD = Math.abs(disp);
          const crest = Math.max(0, Math.min(1, (absD - burnThreshold) / burnRange));
          sizes[index / 3] = basePixel * (1 + crest * sizeBoost);
        }
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    if (pointsRef.current.geometry.attributes.color)
      pointsRef.current.geometry.attributes.color.needsUpdate = true;
    if (pointsRef.current.geometry.attributes.size)
      pointsRef.current.geometry.attributes.size.needsUpdate = true;

    // Update DPR uniform for consistent rendering across devices (no object creation)
    if (matRef.current?.uniforms?.uPixelRatio) {
      matRef.current.uniforms.uPixelRatio.value = gl.getPixelRatio();
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <shaderMaterial
        vertexShader={
          `attribute float size;
           attribute vec3 color;
           varying vec3 vColor;
           uniform float uPixelRatio;
           void main() {
             vColor = color;
             vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
             gl_Position = projectionMatrix * mvPosition;
             // Keep points a consistent screen size
             gl_PointSize = max(1.0, size * uPixelRatio);
           }`
        }
        fragmentShader={
          `precision mediump float;
           varying vec3 vColor;
           uniform float uOpacity;
           uniform float uBrightness;
           void main() {
             vec2 coord = gl_PointCoord - vec2(0.5);
             float r = length(coord);
             float alpha = 1.0 - smoothstep(0.45, 0.5, r);
             if (alpha < 0.01) discard;
             vec3 col = vColor * uBrightness;
             gl_FragColor = vec4(col, alpha * uOpacity);
           }`
        }
        uniforms={{ uPixelRatio: { value: window.devicePixelRatio || 1 }, uOpacity: { value: baseOpacity }, uBrightness: { value: brightness } }}
        ref={matRef}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

export function DotsWave() {
  return (
    <Canvas
      camera={{ position: [0, 50, 10], far: 1000 }}
      gl={{
        antialias: true, // MSAA is cheap on modern hardware; more efficient than post-process AA
        preserveDrawingBuffer: false, // Disabled unless needed for canvas capture
        alpha: false, // No transparency in the canvas itself; handled in shaders
        stencil: false, // Not needed for our scene
        depth: true, // We use depth for perspective
        powerPreference: 'high-performance', // Prefer high-performance GPU on multi-GPU systems
      }}
      style={{ width: '100%', height: '100%' }}>
      <DotsGrid spacing={0.5} baseOpacity={0.8} brightness={0.6} />
    </Canvas>
  );
}
