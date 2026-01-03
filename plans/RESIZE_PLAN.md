# DotsWave Resizable Canvas Plan

## Goal
Make the DotsWave canvas height configurable (e.g., `height="160px"`) while:
- Animation fills full viewport width
- Dots maintain consistent visual spacing (not compressed)
- Full wave amplitude (peaks and dips) remains visible

## Current State
The implementation has been **reverted to the original working state**:
- `src/DotsWave.tsx` - Original implementation with mobile tuning intact
- `src/App.tsx` - Using `<DotsWave />` without height prop (full viewport)

The animation currently works correctly at full viewport height on both mobile and desktop.

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
- [ ] Canvas renders at specified height (e.g., 160px)
- [ ] Animation fills full viewport width
- [ ] Dot spacing matches original full-viewport appearance
- [ ] Full wave amplitude visible (no clipping of peaks/dips)
- [ ] Works on both mobile (< 768px) and desktop viewports
- [ ] Mobile padding optimization preserved (15 vs 30 dots)
- [ ] Default `height="100%"` behavior unchanged from original
