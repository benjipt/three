import { useRef, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface DotsWaveProps {
  spacing?: number
}

function DotsGrid({ spacing = 0.5 }: DotsWaveProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const { viewport } = useThree()
  
  const { geometry, gridWidth, gridHeight } = useMemo(() => {
    const positions: number[] = []
    
    // Calculate grid dimensions based on viewport, with extra padding to hide edges
    const padding = 20 // Extra dots beyond viewport edges to hide wave boundaries
    const width = Math.ceil(viewport.width / spacing) + padding * 2
    // Grid height: make visible column spacing be 5% of viewport height
    const visibleGridHeight = viewport.height * 0.05
    const height = Math.ceil(visibleGridHeight / spacing) + padding * 2
    
    // Create a grid of points
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const posX = (x - width / 2) * spacing
        const posY = (y - height / 2) * spacing
        const posZ = 0
        
        positions.push(posX, posY, posZ)
      }
    }
    
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    
    return { geometry: geom, gridWidth: width, gridHeight: height }
  }, [viewport.width, viewport.height, spacing])
  
  // Animate the wave
  useFrame(({ clock }) => {
    if (!pointsRef.current) return
    
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array
    const time = clock.getElapsedTime()
    
    // Wave parameters
    const waveSpeed = 1.2
    const waveAmplitude = 3.5
    const cycleDuration = 4 // seconds for each waveform
    const transitionDuration = 0.5 // seconds for smooth transition between waveforms
    
    // Calculate which waveform we're on and transition progress
    const totalCycleDuration = cycleDuration * 3
    const cycleTime = time % totalCycleDuration
    const currentWaveIndex = Math.floor(cycleTime / cycleDuration)
    const nextWaveIndex = (currentWaveIndex + 1) % 3
    const timeInCycle = cycleTime % cycleDuration
    
    // Calculate blend factor for smooth interpolation (0 = current wave, 1 = next wave)
    let blendFactor = 0
    if (timeInCycle > cycleDuration - transitionDuration) {
      blendFactor = (timeInCycle - (cycleDuration - transitionDuration)) / transitionDuration
    }
    
    // Function to calculate a specific waveform
    const calculateWaveform = (waveIndex: number, posX: number, time: number): number => {
      switch (waveIndex) {
        case 0:
          // Waveform 1: Smooth, single wave
          return Math.sin(posX * 0.2 - time * waveSpeed) * waveAmplitude * 1.6
        case 1:
          // Waveform 2: Multiple overlapping waves with more complexity
          const w1 = Math.sin(posX * 0.15 - time * waveSpeed * 0.8) * waveAmplitude * 1.2
          const w2 = Math.sin(posX * 0.3 - time * waveSpeed * 1.3) * waveAmplitude * 0.8
          return w1 + w2
        case 2:
          // Waveform 3: Asymmetric, jagged pattern
          const w3 = Math.sin(posX * 0.1 - time * waveSpeed) * waveAmplitude * 1.4
          const w4 = Math.cos(posX * 0.25 - time * waveSpeed * 1.1) * waveAmplitude * 0.6
          const w5 = Math.sin(posX * 0.18 - time * waveSpeed * 0.9) * waveAmplitude * 0.5
          return w3 + w4 + w5
        default:
          return 0
      }
    }
    
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const index = (y * gridWidth + x) * 3
        
        const posX = positions[index]
        const posY = positions[index + 1]
        
        // Calculate current and next waveforms
        const currentWave = calculateWaveform(currentWaveIndex, posX, time)
        const nextWave = calculateWaveform(nextWaveIndex, posX, time)
        
        // Blend between waveforms smoothly
        const blendedWave = currentWave * (1 - blendFactor) + nextWave * blendFactor
        
        // Add subtle position-based variation to all waveforms
        const positionVariation = Math.sin(posX * 0.6 + posY * 0.3) * waveAmplitude * 0.15
        
        positions[index + 2] = blendedWave + positionVariation
      }
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })
  
  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#DC6AA3"
        size={0.1}
        sizeAttenuation={false}
      />
    </points>
  )
}

export function DotsWave() {
  return (
    <Canvas 
      camera={{ position: [0, 0, 30], far: 1000 }}
      style={{ width: '100%', height: '100%' }}
    >
      <DotsGrid spacing={0.5} />
    </Canvas>
  )
}
