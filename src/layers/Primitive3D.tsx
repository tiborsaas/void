import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlobalStore, audioRefs } from '../engine/store'
import { getModulatedValue, getModulatedColor } from '../engine/ModulationEngine'
import { getBlendJSXProps } from '../utils/blendUtils'
import type { Primitive3DLayer, PrimitiveShape } from '../types/layers'

interface Props {
  config: Primitive3DLayer
}

function createPrimitiveGeometry(shape: PrimitiveShape, args: number[]): THREE.BufferGeometry {
  switch (shape) {
    case 'sphere': return new THREE.SphereGeometry(...(args as [number, number, number]))
    case 'box': return new THREE.BoxGeometry(...(args as [number, number, number]))
    case 'torus': return new THREE.TorusGeometry(...(args as [number, number, number, number]))
    case 'torusKnot': return new THREE.TorusKnotGeometry(...(args as [number, number, number, number]))
    case 'cylinder': return new THREE.CylinderGeometry(...(args as [number, number, number, number]))
    case 'cone': return new THREE.ConeGeometry(...(args as [number, number, number]))
    case 'icosahedron': return new THREE.IcosahedronGeometry(...(args as [number, number]))
    case 'octahedron': return new THREE.OctahedronGeometry(...(args as [number, number]))
    case 'dodecahedron': return new THREE.DodecahedronGeometry(...(args as [number, number]))
    default: return new THREE.SphereGeometry(1, 32, 32)
  }
}

/**
 * Primitive3D — basic 3D shapes with materials, rotation, and audio reactivity.
 */
export function Primitive3D({ config }: Props) {
  const meshRef = useRef<THREE.Mesh>(null)
  const beatAccum = useRef(0)

  const geometry = useMemo(
    () => createPrimitiveGeometry(config.shape, config.shapeArgs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.shape, JSON.stringify(config.shapeArgs)],
  )

  useFrame((state) => {
    if (!meshRef.current) return

    const speed = useGlobalStore.getState().masterSpeed
    const hue = useGlobalStore.getState().masterHue
    const intensity = useGlobalStore.getState().masterIntensity
    const id = config.id

    if (audioRefs.beat) beatAccum.current = 1.0
    beatAccum.current *= 0.9

    // Read modulated values (falls back to config if no modulation)
    const modScale = getModulatedValue(id, 'scale', config.scale, 0.01, 10)
    const modRotX = getModulatedValue(id, 'rotationSpeed.0', config.rotationSpeed[0], -3, 3)
    const modRotY = getModulatedValue(id, 'rotationSpeed.1', config.rotationSpeed[1], -3, 3)
    const modRotZ = getModulatedValue(id, 'rotationSpeed.2', config.rotationSpeed[2], -3, 3)
    const modEmissiveInt = getModulatedValue(id, 'emissiveIntensity', config.emissiveIntensity, 0, 5)
    const modMetalness = getModulatedValue(id, 'metalness', config.metalness, 0, 1)
    const modRoughness = getModulatedValue(id, 'roughness', config.roughness, 0, 1)
    const modOpacity = getModulatedValue(id, 'opacity', config.opacity, 0, 1)
    const modColor = getModulatedColor(id, 'color', config.color)
    const modEmissive = getModulatedColor(id, 'emissive', config.emissive)

    // Auto-rotation
    meshRef.current.rotation.x += modRotX * speed * 0.01
    meshRef.current.rotation.y += modRotY * speed * 0.01
    meshRef.current.rotation.z += modRotZ * speed * 0.01

    // Position modulation
    const modPosX = getModulatedValue(id, 'position.0', config.position[0], -10, 10)
    const modPosY = getModulatedValue(id, 'position.1', config.position[1], -10, 10)
    const modPosZ = getModulatedValue(id, 'position.2', config.position[2], -10, 10)
    meshRef.current.position.set(modPosX, modPosY, modPosZ)

    // Audio-reactive scale
    if (config.audioReactive) {
      const s = modScale * (1 + beatAccum.current * 0.2 + audioRefs.amplitude * 0.1)
      meshRef.current.scale.setScalar(s)
    } else {
      meshRef.current.scale.setScalar(modScale)
    }

    // Update material colors
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    if (mat) {
      const baseColor = new THREE.Color(modColor)
      baseColor.offsetHSL(hue, 0, 0)
      mat.color.copy(baseColor)

      if (config.materialType === 'emissive') {
        const emissiveColor = new THREE.Color(modEmissive)
        emissiveColor.offsetHSL(hue, 0, 0)
        mat.emissive = emissiveColor
        mat.emissiveIntensity = modEmissiveInt * intensity
      }

      mat.metalness = modMetalness
      mat.roughness = modRoughness
      mat.opacity = modOpacity * intensity
    }

    void state
  })

  const materialProps: Record<string, unknown> = {
    color: config.color,
    transparent: true,
    opacity: config.opacity,
    wireframe: config.wireframe || config.materialType === 'wireframe',
    metalness: config.metalness,
    roughness: config.roughness,
    side: THREE.DoubleSide,
    ...getBlendJSXProps(config.blendMode),
  }

  if (config.materialType === 'emissive') {
    materialProps.emissive = config.emissive
    materialProps.emissiveIntensity = config.emissiveIntensity
  }

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
    >
      {config.materialType === 'physical' ? (
        <meshPhysicalMaterial key={config.blendMode} {...materialProps} />
      ) : (
        <meshStandardMaterial key={config.blendMode} {...materialProps} />
      )}
    </mesh>
  )
}
