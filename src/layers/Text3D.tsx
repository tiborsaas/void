import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text3D as DreiText3D, Center } from '@react-three/drei'
import * as THREE from 'three'
import { useGlobalStore, audioRefs } from '../engine/store'
import { getModulatedValue, getModulatedColor } from '../engine/ModulationEngine'
import { getBlendJSXProps } from '../utils/blendUtils'
import type { Text3DLayer } from '../types/layers'

interface Props {
  config: Text3DLayer
}

/**
 * Text3D — extruded 3D text with optional rotation and audio reactivity.
 * Requires a font to be available (uses drei's built-in helvetiker by default).
 */
export function Text3D({ config }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const beatAccum = useRef(0)

  useFrame((state) => {
    if (!groupRef.current) return

    const speed = useGlobalStore.getState().masterSpeed
    const hue = useGlobalStore.getState().masterHue
    const intensity = useGlobalStore.getState().masterIntensity
    const id = config.id

    if (audioRefs.beat) beatAccum.current = 1.0
    beatAccum.current *= 0.9

    // Modulated rotation speed
    const modRotX = getModulatedValue(id, 'rotationSpeed.0', config.rotationSpeed[0], -3, 3)
    const modRotY = getModulatedValue(id, 'rotationSpeed.1', config.rotationSpeed[1], -3, 3)
    const modRotZ = getModulatedValue(id, 'rotationSpeed.2', config.rotationSpeed[2], -3, 3)

    groupRef.current.rotation.x += modRotX * speed * 0.01
    groupRef.current.rotation.y += modRotY * speed * 0.01
    groupRef.current.rotation.z += modRotZ * speed * 0.01

    // Position modulation
    const modPosX = getModulatedValue(id, 'position.0', config.position[0], -10, 10)
    const modPosY = getModulatedValue(id, 'position.1', config.position[1], -10, 10)
    const modPosZ = getModulatedValue(id, 'position.2', config.position[2], -10, 10)
    groupRef.current.position.set(modPosX, modPosY, modPosZ)

    // Audio-reactive scale
    if (config.audioReactive) {
      const s = 1 + beatAccum.current * 0.3 + audioRefs.amplitude * 0.2
      groupRef.current.scale.setScalar(s)
    }

    // Modulated values
    const modColor = getModulatedColor(id, 'color', config.color)
    const modEmissive = getModulatedColor(id, 'emissive', config.emissive)
    const modEmissiveInt = getModulatedValue(id, 'emissiveIntensity', config.emissiveIntensity, 0, 5)
    const modOpacity = getModulatedValue(id, 'opacity', config.opacity, 0, 1)

    // Update material colors
    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial

        const baseColor = new THREE.Color(modColor)
        baseColor.offsetHSL(hue, 0, 0)

        if ('color' in mat) {
          mat.color.copy(baseColor)
        }

        if (config.materialType === 'emissive' && 'emissive' in mat) {
          const emissiveColor = new THREE.Color(modEmissive)
          emissiveColor.offsetHSL(hue, 0, 0)
          mat.emissive = emissiveColor
          mat.emissiveIntensity = modEmissiveInt * intensity * modOpacity
        } else if ('emissive' in mat && config.materialType === undefined) {
          const emissiveColor = new THREE.Color(modEmissive)
          emissiveColor.offsetHSL(hue, 0, 0)
          mat.emissive = emissiveColor
          mat.emissiveIntensity = modEmissiveInt * intensity * modOpacity
        }

        mat.opacity = modOpacity
      }
    })

    void state
  })

  // fallback to emissive-like logic for undefined materialType due to old presets
  const effectiveMaterialType = config.materialType ?? 'standard'

  const materialProps: Record<string, unknown> = {
    color: config.color,
    transparent: true,
    opacity: config.opacity,
    wireframe: config.wireframe || effectiveMaterialType === 'wireframe',
    metalness: config.metalness ?? 0,
    roughness: config.roughness ?? 1,
    side: THREE.FrontSide,
    ...getBlendJSXProps(config.blendMode),
  }

  if (effectiveMaterialType === 'emissive' || config.materialType === undefined) {
    materialProps.emissive = config.emissive
    materialProps.emissiveIntensity = config.emissiveIntensity
  }

  return (
    <group
      ref={groupRef}
      position={config.position}
      rotation={config.rotation}
    >
      <Center>
        <DreiText3D
          font="/fonts/helvetiker_regular.typeface.json"
          size={config.fontSize}
          height={config.depth}
          curveSegments={12}
          bevelEnabled
          bevelThickness={0.02}
          bevelSize={0.01}
          bevelSegments={5}
        >
          {config.text}
          {effectiveMaterialType === 'physical' ? (
            <meshPhysicalMaterial key={config.blendMode} {...materialProps} />
          ) : (
            <meshStandardMaterial key={config.blendMode} {...materialProps} />
          )}
        </DreiText3D>
      </Center>
    </group>
  )
}
