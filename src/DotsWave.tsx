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
    
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const index = (y * gridWidth + x) * 3
        
        const posX = positions[index]
        const posY = positions[index + 1]
        
        // Create asymmetric wave by combining multiple sine waves with different directions
        // Primary wave component traveling left to right (based on x position)
        const waveX = 0 // No x-axis movement
        
        // Vertical wave component - points move up/down based on x position as wave travels
        const waveY = Math.sin(posX * 0.2 - time * waveSpeed) * waveAmplitude * 1.6
        
        // Diagonal wave component to break symmetry (only use x position)
        const waveDiagonal = Math.sin(posX * 0.15 - time * waveSpeed * 1.2) * waveAmplitude * 0.3
        
        // Add entropy with subtle noise-like variation based on position
        const noiseX = 0 // No x-axis entropy
        const noiseY = Math.sin(posX * 0.6) * 0.25
        const entropy = (noiseX + noiseY) * waveAmplitude * 0.2
        
        // Combine all wave components with entropy - wave travels left to right
        const wave = waveX + waveY + waveDiagonal + entropy
        
        positions[index + 2] = wave
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
