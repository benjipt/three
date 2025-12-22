# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React + Three.js 3D visualization project that renders an animated wave of dots. The main component is `DotsWave.tsx`, which displays a grid of ~5,000 dots with wave animations modulated by "boid" envelopes.

## Development Commands

```bash
bun run dev      # Start Vite dev server with HMR
bun run build    # TypeScript check + Vite production build
bun run lint     # Run ESLint
bun run preview  # Preview production build
```

Package manager is Bun (bun.lock present).

## Commit Conventions

Make small, atomic commits. Use conventional commit format with scope in square brackets:

```
type[Scope]: description
```

Examples from this repo:
- `feat[DotsWave]: add state for mobile tuning`
- `perf[DotsWave]: smooth boids at entry and exit`
- `fix[App]: correct canvas sizing`

## Architecture

### Core Stack
- React 19 with React Three Fiber for declarative Three.js
- Vite (rolldown-vite variant) for bundling
- TypeScript 5.9 in strict mode
- React Compiler enabled via Babel plugin

### DotsWave Component (`src/DotsWave.tsx`)

The main visualization is a single component (~360 lines) that handles:

**Rendering Pipeline:**
- Custom vertex and fragment shaders for GPU-accelerated dot rendering
- BufferGeometry with position and color attributes updated each frame
- No depth writing for performance

**Animation System:**
- Wave animation: sine carriers with spatial modulation
- Boid envelopes: 4 lanes × 3 boids = 12 moving influence zones
- Gaussian falloff for smooth envelope edges (σx=5.5, σy=1.6)
- 2-second ramp-in prevents jarring startup
- Edge fade zones for smooth boid entry/exit

**Visual Design:**
- Base color: pink (#DC6AA3) transitioning to orange (#FFA548) at wave peaks
- Fog effect at extreme heights (dark brown #0F0A07)
- Vertical tapering at grid edges (6% minimum scale)
- Mobile-responsive padding (15px mobile, 30px desktop)

**Key Constants (tunable at top of file):**
- `GRID_WIDTH`, `GRID_HEIGHT`: dot grid dimensions
- `NUM_LANES`, `BOIDS_PER_LANE`: boid envelope configuration
- `RAMP_DURATION`: startup animation duration
- Gaussian sigma values for envelope falloff
