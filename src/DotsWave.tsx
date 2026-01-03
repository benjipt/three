import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// =============================================================================
// CONSTANTS
// =============================================================================

// Wave parameters
const WAVE_SPEED = 1.2;
const BASE_AMPLITUDE = 3.6;
const CARRIER_FREQ = 0.16;

// Boid parameters
const BOID_LANES = [-6.0, -2.0, 2.0, 6.0];
const BOID_LANE_PHASES = BOID_LANES.map((_, i) => i * 3.6);
const BOIDS_PER_LANE = 3;
const BOID_SPACING_X = 20.0;
const BOID_SIGMA_X = 5.5;
const BOID_SIGMA_Y = 1.6;
const BOID_AMP = 0.8;
const BOID_RAMP_DURATION = 2.0;

// Boid edge fade
const BOID_EDGE_FADE_ZONE = 15.0;
const BOID_LEFT_EDGE = -80;
const BOID_RIGHT_EDGE = 80;

// Color values (linear space)
const BASE_COLOR = { r: 220 / 255, g: 106 / 255, b: 163 / 255 };
const ACCENT_COLOR = { r: 1.0, g: 0.65, b: 0.18 };
const FOG_COLOR = { r: 0.06, g: 0.04, b: 0.03 };

// Color thresholds (relative to BASE_AMPLITUDE)
const BURN_THRESHOLD = BASE_AMPLITUDE * 0.35;
const BURN_RANGE = BASE_AMPLITUDE * 0.9;
const FOG_START = BASE_AMPLITUDE * 0.85;
const FOG_RANGE = BASE_AMPLITUDE * 0.6;

// Size parameters
const BASE_PIXEL_SIZE = 1.2;
const SIZE_BOOST = 1.8;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Deterministic pseudo-random hash function (stable per boid)
 */
function hashBoid(laneIdx: number, boidIdx: number): number {
  const seed = laneIdx * 73856093 ^ boidIdx * 19349663;
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Calculate aggregate boid influence at a given position
 */
function calculateBoidInfluence(
  posX: number,
  posY: number,
  time: number,
  boidRamp: number
): number {
  const drift = Math.sin(time * 0.05) * 2.0;
  let totalInfluence = 0;

  for (let li = 0; li < BOID_LANES.length; li++) {
    const laneY = BOID_LANES[li] + Math.sin(time * 0.25 + BOID_LANE_PHASES[li]) * 0.8;

    for (let bi = 0; bi < BOIDS_PER_LANE; bi++) {
      const boidHash = hashBoid(li, bi);
      const boidSpeedVar = 0.8 + boidHash * 0.4;
      const boidPhaseOffset = boidHash * Math.PI * 2;
      const boidSigmaVar = 0.7 + boidHash * 0.6;

      // Boid X center with wrapping
      let boidCenterX =
        -40 + drift + bi * BOID_SPACING_X + time * (WAVE_SPEED * 12 * boidSpeedVar) + li * 3.0 + boidPhaseOffset;
      boidCenterX = ((boidCenterX % 160) + 160) % 160 - 80;

      // Edge fade for smooth entry/exit
      let edgeFade = 1.0;
      if (boidCenterX < BOID_LEFT_EDGE + BOID_EDGE_FADE_ZONE) {
        edgeFade = Math.max(0, (boidCenterX - BOID_LEFT_EDGE) / BOID_EDGE_FADE_ZONE);
      } else if (boidCenterX > BOID_RIGHT_EDGE - BOID_EDGE_FADE_ZONE) {
        edgeFade = Math.max(0, (BOID_RIGHT_EDGE - boidCenterX) / BOID_EDGE_FADE_ZONE);
      }

      // Gaussian falloff
      const dx = posX - boidCenterX;
      const dy = posY - laneY;
      const gx = Math.exp(-(dx * dx) / (2 * BOID_SIGMA_X * BOID_SIGMA_X * boidSigmaVar));
      const gy = Math.exp(-(dy * dy) / (2 * BOID_SIGMA_Y * BOID_SIGMA_Y * boidSigmaVar));

      totalInfluence += gx * gy * edgeFade;
    }
  }

  return BASE_AMPLITUDE * BOID_AMP * totalInfluence * boidRamp;
}

/**
 * Calculate dot color and size based on displacement
 */
function calculateDotAppearance(displacement: number): { r: number; g: number; b: number; size: number } {
  const absDisp = Math.abs(displacement);

  // Crest factor (0 at base, 1 at full displacement)
  const crest = Math.max(0, Math.min(1, (absDisp - BURN_THRESHOLD) / BURN_RANGE));

  // Interpolate base -> accent based on crest
  let r = BASE_COLOR.r * (1 - crest) + ACCENT_COLOR.r * crest;
  let g = BASE_COLOR.g * (1 - crest) + ACCENT_COLOR.g * crest;
  let b = BASE_COLOR.b * (1 - crest) + ACCENT_COLOR.b * crest;

  // Subtle fog at extreme crests
  let fogFactor = Math.max(0, Math.min(1, (absDisp - FOG_START) / FOG_RANGE));
  fogFactor = Math.pow(fogFactor, 1.5) * 0.35;
  r = r * (1.0 - fogFactor) + FOG_COLOR.r * fogFactor;
  g = g * (1.0 - fogFactor) + FOG_COLOR.g * fogFactor;
  b = b * (1.0 - fogFactor) + FOG_COLOR.b * fogFactor;

  // Size modulation
  const size = BASE_PIXEL_SIZE * (1 + crest * SIZE_BOOST);

  return { r, g, b, size };
}

// =============================================================================
// COMPONENTS
// =============================================================================

interface DotsWaveProps {
  spacing?: number;
  baseOpacity?: number;
  brightness?: number;
}


function DotsGrid({ spacing = 0.01, baseOpacity = 0.85, brightness = 0.9 }: DotsWaveProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport, gl } = useThree();

  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const { geometry, gridWidth, gridHeight } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];

    const baseColor = new THREE.Color('#DC6AA3');
    baseColor.convertSRGBToLinear();

    const padding = isMobile ? 15 : 30;
    const width = Math.ceil(viewport.width / spacing) + padding * 2;
    // Larger multiplier on mobile to make wave more prominent in taller viewport
    const heightMultiplier = isMobile ? 0.065 : 0.05;
    const visibleGridHeight = viewport.height * heightMultiplier;
    const height = Math.ceil(visibleGridHeight / spacing) + padding * 2;

    const edgeScale = 0.06;
    const taperPower = 1.1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const posX = (x - width / 2) * spacing;
        let posY = (y - height / 2) * spacing;

        // Vertical taper near edges
        const halfWidthUnits = (width / 2) * spacing;
        const nx = Math.max(0, Math.min(1, Math.abs(posX) / halfWidthUnits));
        const spread = 1.0 - Math.pow(nx, taperPower);
        const scaleY = edgeScale + (1.0 - edgeScale) * spread;
        posY *= scaleY;

        positions.push(posX, posY, 0);
        colors.push(baseColor.r, baseColor.g, baseColor.b);
        sizes.push(BASE_PIXEL_SIZE);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    geom.setAttribute('size', new THREE.BufferAttribute(new Float32Array(sizes), 1));

    return { geometry: geom, gridWidth: width, gridHeight: height };
  }, [viewport.width, viewport.height, spacing, isMobile]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const colors = pointsRef.current.geometry.attributes.color?.array as Float32Array | null;
    const sizes = pointsRef.current.geometry.attributes.size?.array as Float32Array | null;

    const time = clock.getElapsedTime();
    const boidRamp = Math.min(1.0, time / BOID_RAMP_DURATION);
    const baseLocalAmp = BASE_AMPLITUDE * 0.6;

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const index = (y * gridWidth + x) * 3;
        const posX = positions[index];
        const posY = positions[index + 1];

        // Wave phase and amplitude
        const phase = posX * CARRIER_FREQ - time * WAVE_SPEED;
        const boidInfluence = calculateBoidInfluence(posX, posY, time, boidRamp);
        const localAmp = baseLocalAmp + boidInfluence;

        // Displacement
        const displacement = Math.sin(phase) * localAmp;
        positions[index + 2] = displacement;

        // Appearance
        const appearance = calculateDotAppearance(displacement);
        if (colors) {
          colors[index] = appearance.r;
          colors[index + 1] = appearance.g;
          colors[index + 2] = appearance.b;
        }
        if (sizes) {
          sizes[index / 3] = appearance.size;
        }
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    if (pointsRef.current.geometry.attributes.color) {
      pointsRef.current.geometry.attributes.color.needsUpdate = true;
    }
    if (pointsRef.current.geometry.attributes.size) {
      pointsRef.current.geometry.attributes.size.needsUpdate = true;
    }

    // Update shader uniforms
    if (matRef.current?.uniforms) {
      const dpr = gl.getPixelRatio();
      if (matRef.current.uniforms.uPixelRatio) {
        matRef.current.uniforms.uPixelRatio.value = dpr;
      }
      if (matRef.current.uniforms.uBrightness) {
        const boost = dpr < 1.5 ? 1.08 : 1.0;
        matRef.current.uniforms.uBrightness.value = (brightness ?? 1.0) * boost;
      }
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <shaderMaterial
        vertexShader={`
          attribute float size;
          attribute vec3 color;
          varying vec3 vColor;
          uniform float uPixelRatio;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = max(1.0, size * uPixelRatio);
          }
        `}
        fragmentShader={`
          precision mediump float;
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
          }
        `}
        uniforms={{
          uPixelRatio: { value: window.devicePixelRatio || 1 },
          uOpacity: { value: baseOpacity },
          uBrightness: { value: brightness },
        }}
        ref={matRef}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

interface DotsWaveContainerProps {
  /**
   * Height of the wave container.
   * - Use '100%' (default) for full viewport height
   * - Use pixel values like '240px' for constrained layouts
   * - Other CSS units (vh, rem, calc, etc.) are NOT supported
   * - Minimum: 240px - values below this are coerced up to prevent clipping wave peaks
   */
  height?: string;
}

// PERFORMANCE NOTE: Fixed-height mode renders at 900px internally (regardless of
// target height) to maintain correct wave amplitude via viewport.height calculations.
// This is ~4x overhead for 240px targets. The trade-off is necessary because the
// perspective camera's visible world-space depends on canvas pixel height.
const INTERNAL_RENDER_HEIGHT = 900;

// Minimum height to avoid clipping wave peaks during boid animations.
// Heights below this are silently coerced up.
const MIN_RECOMMENDED_HEIGHT = 240;

// Shared Canvas configuration to avoid duplication
const CAMERA_CONFIG = { position: [0, 50, 20] as const, far: 1000 };
const GL_CONFIG = {
  antialias: true,
  preserveDrawingBuffer: false,
  alpha: false,
  stencil: false,
  depth: true,
  powerPreference: 'high-performance' as const,
};
const DOTS_GRID_PROPS = { spacing: 0.4, baseOpacity: 0.7, brightness: 0.9 };

function handleCanvasCreated({ gl }: { gl: THREE.WebGLRenderer }) {
  const rendererWithCS = gl as unknown as { outputColorSpace?: number };
  if (typeof rendererWithCS.outputColorSpace !== 'undefined') {
    const SRGB = (THREE as unknown as { SRGBColorSpace?: number }).SRGBColorSpace ?? 3001;
    rendererWithCS.outputColorSpace = SRGB as number;
  }
}

export function DotsWave({ height = '100%' }: DotsWaveContainerProps) {
  // For fixed heights, use CSS clipping approach
  const isFixedHeight = height !== '100%';

  if (isFixedHeight) {
    // Parse and coerce height to minimum to avoid clipping wave peaks
    const parsedHeight = parseInt(height, 10) || INTERNAL_RENDER_HEIGHT;
    const targetHeight = Math.max(parsedHeight, MIN_RECOMMENDED_HEIGHT);

    // Offset to center the wave (wave is centered in the internal render)
    const offset = (INTERNAL_RENDER_HEIGHT - targetHeight) / 2;

    return (
      <div style={{
        width: '100%',
        height: `${targetHeight}px`,
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: -offset,
          left: 0,
          width: '100%',
          height: INTERNAL_RENDER_HEIGHT,
        }}>
          <Canvas
            camera={CAMERA_CONFIG}
            gl={GL_CONFIG}
            onCreated={handleCanvasCreated}
            style={{ width: '100%', height: '100%' }}
          >
            <DotsGrid {...DOTS_GRID_PROPS} />
          </Canvas>
        </div>
      </div>
    );
  }

  // Default: full viewport rendering (original behavior)
  return (
    <Canvas
      camera={CAMERA_CONFIG}
      gl={GL_CONFIG}
      onCreated={handleCanvasCreated}
      style={{ width: '100%', height: '100%' }}
    >
      <DotsGrid {...DOTS_GRID_PROPS} />
    </Canvas>
  );
}
