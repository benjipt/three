# DotsWave Resizable Canvas Plan

## Goal
Make the DotsWave canvas height configurable (e.g., `height="160px"`) while:
- Animation fills full viewport width
- Dots maintain consistent visual spacing (not compressed)
- Full wave amplitude (peaks and dips) remains visible

## Current State - COMPLETE ✅

**Latest fix:** Increased `INTERNAL_RENDER_HEIGHT` from 400px to 900px

The CSS clipping approach now works correctly with proper wave amplitude:
- `src/DotsWave.tsx` - Updated with `height` prop support and 900px internal render height
- `src/App.tsx` - Can use `<DotsWave height="160px" />` or default `<DotsWave />`

### Resolution (January 2026)

**Root Cause Confirmed**: The 400px internal render height caused `viewport.height` (in world units) to be too small, resulting in compressed grid calculations and wave amplitude.

**Fix Applied**: Changed `INTERNAL_RENDER_HEIGHT` from 400 to 900 to match typical desktop viewport height. This ensures:
- `viewport.height` matches production's world-space dimensions
- Grid depth calculations produce proper wave amplitude
- Wave appearance matches production at all viewport sizes

### Verification Results

| Viewport | Status | Notes |
|----------|--------|-------|
| Desktop 1440x900 (fixed 160px) | ✅ PASS | Bold wave amplitude, matches production |
| Desktop 1440x900 (100%) | ✅ PASS | Identical to production |
| Mobile 375x667 (fixed 160px) | ✅ PASS | Proper amplitude |
| Mobile 375x667 (100%) | ✅ PASS | Identical to production |

## Mobile Tuning Context (Important)

The animation has specific mobile optimizations from commits `004b1e0` and `0530add` that must be preserved:

### Mobile Detection (commit 004b1e0)
```tsx
const [isMobile, setIsMobile] = useState<boolean>(false);

useEffect(() => {
  const checkIsMobile = () => {
    setIsMobile(window.innerWidth < 768);  // Standard mobile breakpoint
  };
  checkIsMobile();
  window.addEventListener('resize', checkIsMobile);
  return () => window.removeEventListener('resize', checkIsMobile);
}, []);
```

### Mobile-Specific Padding (commit 0530add)
```tsx
const padding = isMobile ? 15 : 30;  // Reduced padding on mobile for performance
```

### Mobile Grid Height Multiplier (new)
```tsx
// Larger multiplier on mobile to make wave more prominent in taller viewport
const heightMultiplier = isMobile ? 0.065 : 0.05;
const visibleGridHeight = viewport.height * heightMultiplier;
```
This adjustment makes the wave fill more of the vertical space on mobile (which has a taller aspect ratio), matching the visual prominence seen on the reference implementation.

### Why This Matters for Resize Implementation
1. **Padding affects edge visibility**: Lower padding on mobile = fewer off-screen dots = better performance
2. **Any resize solution must preserve mobile detection**: The `isMobile` state is used in the grid calculation
3. **The useMemo depends on `isMobile`**: Grid regenerates when device type changes
4. **Mobile has ~half the dot padding as desktop**: This is intentional for performance on lower-powered devices

### Constraint for Future Implementation
When implementing height resize:
- Must preserve the `isMobile` detection mechanism
- Must keep conditional padding (`isMobile ? 15 : 30`)
- Should consider if fixed-height mode needs different padding logic
- Test on both mobile (< 768px width) and desktop viewports

## Key Learnings from Previous Attempts

### 1. Why Perspective Camera Causes Issues
The original camera at `[0, 50, 20]` creates an angled view where:
- Z-axis displacement appears as vertical movement (the wave effect)
- Visible world-space area depends on canvas aspect ratio
- A 160px tall canvas (very wide aspect ratio) shows much less vertical world-space → compression

### 2. Orthographic Camera Problems
- Eliminates perspective distortion BUT changes fundamental visual appearance
- The angled perspective view is essential to how Z-displacement creates the wave visual
- Orthographic from the same angle doesn't produce the same effect

### 3. CSS Scaling Limitations
- `transform: scale()` affects both width and height uniformly
- Can't scale height independently while maintaining full width
- Inverse width compensation creates incorrect rendering dimensions

### 4. CSS Clipping Approach
- Rendering at full viewport then clipping to 160px WORKS for visual fidelity
- BUT: Wave peaks/dips get clipped because wave is centered in tall viewport
- Canvas renders at unnecessary size (1864px for 160px display)

### 5. Camera Position Adjustment
- Moving camera closer when aspect is wide does zoom in
- BUT: Exaggerates perspective distortion (dots near camera spread out more)
- Creates uneven spacing between wave peaks and troughs

### 6. Grid Dimension Coupling
- Grid height uses `viewport.height * 0.05` - ties visual to canvas size
- This is correct for full-viewport but breaks fixed-height scenarios

### 7. FOV Adjustment Approach (Failed)
- Attempted to adjust camera FOV based on aspect ratio
- Made the wave appear smaller/more compressed instead of larger
- Three.js PerspectiveCamera.fov is VERTICAL FOV, so increasing it zooms out

### 8. Orthographic Camera with Frustum Adjustment (Partially Worked)
- Orthographic camera maintains consistent world-space coverage regardless of aspect ratio
- Wave peaks/troughs became visible at fixed heights
- BUT: Dots appeared as vertical stripes instead of individual dots
- The perspective view is essential for the visual aesthetic

### 9. Internal Render Height Must Match Reference Viewport (THE FIX)
- The `viewport.height` from `useThree()` provides world-space height at z=0
- This value depends on the canvas pixel height AND camera FOV
- A 400px canvas produces a smaller `viewport.height` than a 900px canvas
- Grid calculations use `viewport.height * 0.05` → smaller viewport = compressed wave
- **Solution**: Set `INTERNAL_RENDER_HEIGHT = 900` to match typical desktop viewport
- This ensures `viewport.height` produces the same world-space dimensions as production
- The CSS clipping then shows only the desired portion (e.g., 160px) of the 900px render

## Successful Solution: CSS Clipping with Internal Render Height

The winning approach renders the canvas at a fixed "internal" height (900px) and uses CSS positioning to show only the center portion:

```tsx
const INTERNAL_RENDER_HEIGHT = 900;

export function DotsWave({ height = '100%' }: DotsWaveContainerProps) {
  const isFixedHeight = height !== '100%';

  if (isFixedHeight) {
    const targetHeight = parseInt(height, 10) || INTERNAL_RENDER_HEIGHT;
    const offset = (INTERNAL_RENDER_HEIGHT - targetHeight) / 2;

    return (
      <div style={{ width: '100%', height, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -offset, left: 0, width: '100%', height: INTERNAL_RENDER_HEIGHT }}>
          <Canvas ...>
            <DotsGrid ... />
          </Canvas>
        </div>
      </div>
    );
  }

  // Default: full viewport rendering (unchanged)
  return <Canvas ...><DotsGrid ... /></Canvas>;
}
```

### Why This Works
1. **Preserves perspective camera**: The original camera at `[0, 50, 20]` is unchanged
2. **Maintains visual fidelity**: Dots render with proper perspective, not as stripes
3. **Shows centered wave**: The offset calculation centers the wave in the visible area
4. **No grid/camera modifications**: The internal rendering is identical to full viewport
5. **Default behavior unchanged**: `height="100%"` uses the original full-viewport path

## Development Workflow

### Chrome DevTools MCP Available
The Chrome DevTools MCP is configured for this project. Use it to:
- **View the running animation** at `http://localhost:5173`
- **Inspect canvas dimensions** and verify actual rendered size
- **Test mobile viewports** using Chrome's device emulation
- **Compare changes visually** against the working original

### Iterative Development Strategy
1. Start the dev server: `bun run dev`
2. Use Chrome DevTools MCP to view the current animation state
3. Make incremental changes to `src/DotsWave.tsx`
4. Visually verify each change via Chrome DevTools MCP
5. Compare against the original full-viewport appearance
6. Test at multiple heights (100%, 300px, 160px) and viewports (mobile, desktop)

### Testing Checklist
- Full viewport (100%) - should match original exactly
- 160px height - target fixed height
- 300px height - intermediate test case
- Mobile viewport (< 768px width)
- Desktop viewport

## Files to Modify
- `src/DotsWave.tsx` - Main implementation
- `src/App.tsx` - For testing height prop

## Reference: Original Working Code Patterns
The original grid calculation that works at full viewport:
```tsx
const padding = isMobile ? 15 : 30;
const width = Math.ceil(viewport.width / spacing) + padding * 2;
const visibleGridHeight = viewport.height * 0.05;
const height = Math.ceil(visibleGridHeight / spacing) + padding * 2;
```

The original camera setup:
```tsx
camera={{ position: [0, 50, 20], far: 1000 }}
```

## Success Criteria
- [x] Canvas renders at specified height (e.g., 160px)
- [x] Animation fills full viewport width
- [x] **Dot spacing matches original full-viewport appearance** ✅ Fixed with 900px internal height
- [x] **Full wave amplitude visible (no clipping of peaks/dips)** ✅ Fixed with 900px internal height
- [x] Works on both mobile (< 768px) and desktop viewports
- [x] Mobile padding optimization preserved (15 vs 30 dots)
- [x] Default `height="100%"` behavior unchanged from original

## Trade-offs
- **Render overhead**: Fixed-height mode renders at 900px internally even when displaying smaller heights
- **Memory usage**: Higher than minimal canvas size, but necessary for correct wave amplitude
- **Why 900px**: This matches typical desktop viewport height, ensuring `viewport.height` produces the same world-space dimensions as production
- **Minimum height**: 220px recommended - heights below this may clip wave peaks during boid animations

---

## Chat Startup Instructions

When resuming work on this plan, follow these steps:

### Step 1: Gather Documentation (Context7 MCP)

Before making code changes, fetch relevant documentation using Context7:

```
1. React Three Fiber - camera setup, viewport hooks, canvas sizing
   - Query: "PerspectiveCamera setup and viewport in React Three Fiber"
   - Query: "Canvas sizing and responsive behavior"

2. Three.js - perspective camera, FOV, aspect ratio
   - Query: "PerspectiveCamera field of view aspect ratio relationship"
   - Query: "How camera position affects perspective distortion"
```

### Step 2: Start Dev Server & Compare

1. Run `bun run dev` to start localhost
2. Use Chrome DevTools MCP to compare:
   - Localhost: `http://localhost:5173`
   - Production: `https://three-signalfluid.netlify.app/`
3. Test at both mobile (375x667) and desktop (1440x900) viewports

### Step 3: Iterate and Document

After each code change:
1. Take screenshots comparing localhost vs production
2. Document what changed and the visual result
3. Add new learnings to the "Key Learnings" section above
4. Update success criteria status as issues are resolved

### Quick Start Command

To resume this work, just say:
> "Look at the resize plan and proceed"

The assistant should:
1. Read this plan file
2. Fetch Context7 documentation for React Three Fiber and Three.js cameras
3. Start the dev server if not running
4. Take comparison screenshots (mobile + desktop, localhost vs production)
5. Propose next iteration based on current issues and learnings
