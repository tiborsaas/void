import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlobalStore, audioRefs } from '../engine/store'
import { getModulatedValue } from '../engine/ModulationEngine'
import { getBlendJSXProps } from '../utils/blendUtils'
import type { DisplacedMeshLayer, MeshGeometryType } from '../types/layers'

interface Props {
  config: DisplacedMeshLayer
}

function createGeometry(type: MeshGeometryType, args: number[]): THREE.BufferGeometry {
  switch (type) {
    case 'sphere': return new THREE.SphereGeometry(...(args as [number, number, number]))
    case 'icosahedron': return new THREE.IcosahedronGeometry(...(args as [number, number]))
    case 'torus': return new THREE.TorusGeometry(...(args as [number, number, number, number]))
    case 'torusKnot': return new THREE.TorusKnotGeometry(...(args as [number, number, number, number]))
    case 'box': return new THREE.BoxGeometry(...(args as [number, number, number]))
    case 'plane': return new THREE.PlaneGeometry(...(args as [number, number, number, number]))
    case 'cylinder': return new THREE.CylinderGeometry(...(args as [number, number, number, number]))
    default: return new THREE.SphereGeometry(1, 64, 64)
  }
}

/**
 * DisplacedMesh — 3D mesh with vertex displacement shader.
 * Used for LiquidMetal, NeuralMesh-like effects.
 */
export function DisplacedMesh({ config }: Props) {
  const meshRef = useRef<THREE.Mesh>(null)
  const beatAccum = useRef(0)

  const geometry = useMemo(
    () => createGeometry(config.geometry, config.geometryArgs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.geometry, JSON.stringify(config.geometryArgs)],
  )

  const uniforms = useMemo(() => {
    const u: Record<string, { value: unknown }> = {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uAmplitude: { value: 0 },
      uBeat: { value: 0 },
      uHue: { value: 0 },
      uIntensity: { value: 1 },
    }
    if (config.uniforms) {
      for (const [key, def] of Object.entries(config.uniforms)) {
        u[key] = { value: def.value }
      }
    }
    return u
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id])

  useFrame((state, delta) => {
    const speed = useGlobalStore.getState().masterSpeed
    const hue = useGlobalStore.getState().masterHue
    const intensity = useGlobalStore.getState().masterIntensity
    const id = config.id

    uniforms.uTime.value = state.clock.elapsedTime * speed
    uniforms.uBass.value = audioRefs.bands[0]
    uniforms.uMid.value = audioRefs.bands[2]
    uniforms.uTreble.value = audioRefs.bands[4]
    uniforms.uAmplitude.value = audioRefs.amplitude
    uniforms.uHue.value = hue
    uniforms.uIntensity.value = intensity * getModulatedValue(id, 'opacity', config.opacity, 0, 1)

    if (audioRefs.beat) beatAccum.current = 1.0
    beatAccum.current *= 0.92
    uniforms.uBeat.value = beatAccum.current

    // Sync user-defined uniforms from config (with modulation)
    if (config.uniforms) {
      for (const [key, def] of Object.entries(config.uniforms)) {
        if (uniforms[key]) {
          const modPath = `uniforms.${key}.value`
          const base = typeof def.value === 'number' ? def.value : 0
          uniforms[key].value = typeof def.value === 'number'
            ? getModulatedValue(id, modPath, base, def.min ?? -100, def.max ?? 100)
            : def.value
        }
      }
    }

    if (meshRef.current) {
      // Modulated rotation speed
      const modRotX = getModulatedValue(id, 'rotationSpeed.0', config.rotationSpeed[0], -3, 3)
      const modRotY = getModulatedValue(id, 'rotationSpeed.1', config.rotationSpeed[1], -3, 3)
      const modRotZ = getModulatedValue(id, 'rotationSpeed.2', config.rotationSpeed[2], -3, 3)

      meshRef.current.rotation.x += modRotX * speed * delta
      meshRef.current.rotation.y += modRotY * speed * delta
      meshRef.current.rotation.z += modRotZ * speed * delta

      // Audio-reactive scale pulsing
      const baseScale = getModulatedValue(id, 'scale', config.scale ?? 1, 0.01, 20)
      if (config.audioReactive) {
        const s = baseScale * (1 + beatAccum.current * 0.25 + audioRefs.amplitude * 0.15)
        meshRef.current.scale.setScalar(s)
      } else {
        meshRef.current.scale.setScalar(baseScale)
      }
    }
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={config.rotation}
    >
      <shaderMaterial
        vertexShader={config.vertexShader}
        fragmentShader={config.fragmentShader}
        uniforms={uniforms}
        wireframe={config.wireframe}
        key={config.blendMode}
        {...(getBlendJSXProps(config.blendMode) as object)}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
