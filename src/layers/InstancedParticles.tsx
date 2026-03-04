import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlobalStore, audioRefs } from '../engine/store'
import { getModulatedValue, getModulatedColor } from '../engine/ModulationEngine'
import { getBlendJSXProps } from '../utils/blendUtils'
import type { InstancedParticlesLayer } from '../types/layers'

interface Props {
  config: InstancedParticlesLayer
}

const _dummy = new THREE.Object3D()
const _color = new THREE.Color()

/**
 * InstancedParticles — high-performance particle system using InstancedMesh.
 * CPU-simulated with gravitational attractors and audio reactivity.
 */
export function InstancedParticles({ config }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  // Particle state arrays
  const state = useMemo(() => {
    const count = config.count
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const ages = new Float32Array(count)

    // Random initial positions in a sphere
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = Math.random() * 3
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      velocities[i * 3] = (Math.random() - 0.5) * 0.01
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01
      ages[i] = Math.random()
    }
    return { positions, velocities, ages }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.count])

  const geometry = useMemo(() => {
    if (config.geometry === 'box') return new THREE.BoxGeometry(config.size, config.size, config.size)
    return new THREE.SphereGeometry(config.size * 0.5, 6, 6)
  }, [config.geometry, config.size])

  useFrame((frameState, delta) => {
    if (!meshRef.current) return

    const speed = useGlobalStore.getState().masterSpeed
    const hue = useGlobalStore.getState().masterHue
    const intensity = useGlobalStore.getState().masterIntensity
    const dt = Math.min(delta, 0.05) * speed
    const count = config.count
    const id = config.id
    const audioBoost = config.audioReactive ? audioRefs.amplitude : 0

    const modDamping = getModulatedValue(id, 'damping', config.damping, 0, 1)
    const modMaxSpeed = getModulatedValue(id, 'maxSpeed', config.maxSpeed, 0.01, 5)
    const modOpacity = getModulatedValue(id, 'opacity', config.opacity, 0, 1)
    const modColor = getModulatedColor(id, 'color', config.color)

    // Simulate
    for (let i = 0; i < count; i++) {
      const ix = i * 3
      const iy = ix + 1
      const iz = ix + 2

      // Gravitational attractors (with modulated strength/position)
      for (let ai = 0; ai < config.attractors.length; ai++) {
        const attractor = config.attractors[ai]
        const modAx = getModulatedValue(id, `attractors.${ai}.position.0`, attractor.position[0], -10, 10)
        const modAy = getModulatedValue(id, `attractors.${ai}.position.1`, attractor.position[1], -10, 10)
        const modAz = getModulatedValue(id, `attractors.${ai}.position.2`, attractor.position[2], -10, 10)
        const modStr = getModulatedValue(id, `attractors.${ai}.strength`, attractor.strength, -5, 5)

        const dx = modAx - state.positions[ix]
        const dy = modAy - state.positions[iy]
        const dz = modAz - state.positions[iz]
        const distSq = dx * dx + dy * dy + dz * dz + 0.1
        const force = (modStr * (1 + audioBoost * 2)) / distSq

        state.velocities[ix] += dx * force * dt
        state.velocities[iy] += dy * force * dt
        state.velocities[iz] += dz * force * dt
      }

      // Damping
      state.velocities[ix] *= 1 - modDamping * dt
      state.velocities[iy] *= 1 - modDamping * dt
      state.velocities[iz] *= 1 - modDamping * dt

      // Clamp speed
      const speed2 = state.velocities[ix] ** 2 + state.velocities[iy] ** 2 + state.velocities[iz] ** 2
      if (speed2 > modMaxSpeed * modMaxSpeed) {
        const s = modMaxSpeed / Math.sqrt(speed2)
        state.velocities[ix] *= s
        state.velocities[iy] *= s
        state.velocities[iz] *= s
      }

      // Integrate
      state.positions[ix] += state.velocities[ix] * dt * 60
      state.positions[iy] += state.velocities[iy] * dt * 60
      state.positions[iz] += state.velocities[iz] * dt * 60

      // Age
      state.ages[i] = (state.ages[i] + dt * 0.1) % 1.0

      // Update instance matrix
      _dummy.position.set(state.positions[ix], state.positions[iy], state.positions[iz])
      _dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, _dummy.matrix)

      // Coloring
      const v = Math.sqrt(speed2) / modMaxSpeed
      switch (config.colorMode) {
        case 'velocity':
          _color.setHSL((hue + v * 0.3) % 1, 0.8, 0.3 + v * 0.5)
          break
        case 'position':
          _color.setHSL((hue + state.positions[ix] * 0.1) % 1, 0.7, 0.5)
          break
        case 'age':
          _color.setHSL((hue + state.ages[i] * 0.5) % 1, 0.9, 0.4 + state.ages[i] * 0.4)
          break
        default:
          _color.set(modColor)
          break
      }
      _color.multiplyScalar(intensity * modOpacity)
      meshRef.current.setColorAt(i, _color)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, config.count]}
      frustumCulled={false}
    >
      <meshBasicMaterial
        toneMapped={false}
        key={config.blendMode}
        {...(getBlendJSXProps(config.blendMode) as object)}
        depthWrite={false}
      />
    </instancedMesh>
  )
}
