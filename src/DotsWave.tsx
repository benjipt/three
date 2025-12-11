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
    const padding = 5 // Extra dots beyond viewport edges
    const width = Math.ceil(viewport.width / spacing) + padding * 2
    const height = Math.ceil((viewport.height * 0.6) / spacing) + padding * 2
    
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
    const waveFrequency = 1.5
    const waveAmplitude = 1.5
    
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const index = (y * gridWidth + x) * 3
        
        const posX = positions[index]
        const posY = positions[index + 1]
        
        // Create ripple effect using sine waves
        const distance = Math.sqrt(posX * posX + posY * posY) * 0.2
        const wave = Math.sin(distance * waveFrequency - time * waveSpeed) * waveAmplitude
        
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
