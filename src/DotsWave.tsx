import { useRef, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface DotsWaveProps {
  spacing?: number
}

function DotsGrid({ spacing = 0.5 }: DotsWaveProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const { viewport } = useThree()
  
  const { geometry } = useMemo(() => {
    const positions: number[] = []
    
    // Calculate grid dimensions based on viewport
    const width = Math.ceil(viewport.width / spacing)
    const height = Math.ceil((viewport.height * 0.6) / spacing)
    
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
    
    return { geometry: geom }
  }, [viewport.width, viewport.height, spacing])
  
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
