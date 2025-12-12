import { useRef, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DotsWaveProps {
  spacing?: number;
  baseOpacity?: number;
  brightness?: number;
}

function DotsGrid({ spacing = 0.6, brightness = 0.9 }: DotsWaveProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const { viewport } = useThree();

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

    // Crest color burn + Depth fog band variables
    const accent = [1.0, 0.65, 0.18]; // warm accent (orange)
    const fogColor = [0.06, 0.04, 0.03]; // dark fog tint
    const burnThreshold = baseAmp * 0.35; // displacement at which accent begins
    const burnRange = baseAmp * 0.9; // span of accent ramp
    const fogStart = baseAmp * 0.7; // when fog starts to take effect
    const fogRange = baseAmp * 0.9;

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

          // Fog band: stronger for larger crests (or higher displacement)
          const fogFactor = Math.max(0, Math.min(1, (absD - fogStart) / fogRange));
          r = r * (1 - fogFactor) + fogColor[0] * fogFactor;
          g = g * (1 - fogFactor) + fogColor[1] * fogFactor;
          b = b * (1 - fogFactor) + fogColor[2] * fogFactor;

          // Apply brightness multiplier directly to the per-vertex color
          r = r * brightness;
          g = g * brightness;
          b = b * brightness;

          colors[index] = r;
          colors[index + 1] = g;
          colors[index + 2] = b;
        }

        if (sizes) {
          // Make subtle size modulation based on crest (bigger for crests)
          const basePixel = 0.8; // baseline pixel size
          const sizeBoost = 1.2; // maximum extra multiplier for crests
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
  });

  // Note: opacity is controlled via Canvas CSS in the parent for immediate visual response.

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
           void main() {
             vec2 coord = gl_PointCoord - vec2(0.5);
             float r = length(coord);
             float alpha = 1.0 - smoothstep(0.45, 0.5, r);
             if (alpha < 0.01) discard;
             gl_FragColor = vec4(vColor, alpha);
           }`
        }
        uniforms={{ uPixelRatio: { value: window.devicePixelRatio || 1 } }}
        transparent
        depthWrite={false}
      />
    </points>
  );
}


export function DotsWave() {
  const [baseOpacity, setBaseOpacity] = useState(0.78);
  const [brightness, setBrightness] = useState(0.75);

  const controlPanelStyle: CSSProperties = {
    position: 'absolute',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(8, 6, 6, 0.45)',
    padding: '8px 12px',
    borderRadius: 10,
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    backdropFilter: 'blur(6px)',
    zIndex: 10,
    fontFamily: 'Inter, Arial, sans-serif',
  };

  const controlRowStyle: CSSProperties = {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  };

  const labelStyle: CSSProperties = {
    color: '#fff',
    fontSize: 12,
    minWidth: 60,
  };

  const inputStyle: CSSProperties = {
    width: 160,
  };

  const numberStyle: CSSProperties = {
    width: 60,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: '#fff',
    padding: '4px 6px',
    borderRadius: 6,
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Canvas
        camera={{ position: [0, 40, 10], far: 1000 }}
        style={{ width: '100%', height: '100%', opacity: baseOpacity }}>
        <DotsGrid spacing={0.5} brightness={brightness} />
      </Canvas>

      <div style={controlPanelStyle}>
        <div style={controlRowStyle}>
          <label style={labelStyle}>Opacity</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={baseOpacity}
            onChange={(e) => setBaseOpacity(parseFloat(e.target.value))}
            style={inputStyle}
          />
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={baseOpacity}
            onChange={(e) => setBaseOpacity(parseFloat(e.target.value) || 0)}
            style={numberStyle}
          />
        </div>

        <div style={controlRowStyle}>
          <label style={labelStyle}>Brightness</label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={brightness}
            onChange={(e) => setBrightness(parseFloat(e.target.value))}
            style={inputStyle}
          />
          <input
            type="number"
            min={0}
            max={2}
            step={0.01}
            value={brightness}
            onChange={(e) => setBrightness(parseFloat(e.target.value) || 0)}
            style={numberStyle}
          />
        </div>
      </div>
    </div>
  );
}
