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
    const padding = 10 // Extra dots beyond viewport edges
    const width = Math.ceil(viewport.width / spacing) + padding * 2
    const height = Math.ceil((viewport.height * 0.4) / spacing) + padding * 2
    
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
    const waveSpeed = 1.5
    const waveAmplitude = 1.5
    
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const index = (y * gridWidth + x) * 3
        
        const posX = positions[index]
        const posY = positions[index + 1]
        
        // Create asymmetric wave by combining multiple sine waves with different directions
        // Horizontal wave component
        const waveX = Math.sin(posX * 0.3 - time * waveSpeed) * waveAmplitude
        
        // Vertical wave component with different frequency
        const waveY = Math.sin(posY * 0.4 + time * waveSpeed * 0.7) * waveAmplitude * 0.8
        
        // Diagonal wave component to break symmetry
        const waveDiagonal = Math.sin((posX * 0.2 + posY * 0.25) - time * waveSpeed * 1.2) * waveAmplitude * 0.6
        
        // Combine all wave components
        const wave = waveX + waveY + waveDiagonal
        
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
