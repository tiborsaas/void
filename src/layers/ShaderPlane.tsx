import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlobalStore, audioRefs } from '../engine/store'
import { getModulatedValue } from '../engine/ModulationEngine'
import { getBlendJSXProps } from '../utils/blendUtils'
import type { ShaderPlaneLayer } from '../types/layers'

interface Props {
  config: ShaderPlaneLayer
}

/**
 * ShaderPlane — fullscreen quad with custom vertex/fragment shaders.
 * Used for raymarching, procedural effects, matrix rain, terrain, tunnel, etc.
 * Shader code is live-editable: the material is re-created whenever
 * vertexShader or fragmentShader strings change.
 */
export function ShaderPlane({ config }: Props) {
  const meshRef = useRef<THREE.Mesh>(null)
  const beatAccum = useRef(0)

  // Re-create uniforms when the layer identity *or* the shader source changes,
  // so a freshly compiled material always gets a clean uniform set.
  const uniforms = useMemo(() => {
    const u: Record<string, { value: unknown }> = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1920, 1080) },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uAmplitude: { value: 0 },
      uBeat: { value: 0 },
      uHue: { value: 0 },
      uIntensity: { value: 1 },
      uSpeed: { value: 1 },
    }
    // Merge layer-specific uniforms
    if (config.uniforms) {
      for (const [key, def] of Object.entries(config.uniforms)) {
        u[key] = { value: def.value }
      }
    }
    return u
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id, config.vertexShader, config.fragmentShader])

  useFrame((state) => {
    const speed = useGlobalStore.getState().masterSpeed
    const hue = useGlobalStore.getState().masterHue
    const intensity = useGlobalStore.getState().masterIntensity

    uniforms.uTime.value = state.clock.elapsedTime * speed
    uniforms.uBass.value = audioRefs.bands[0]
    uniforms.uMid.value = audioRefs.bands[2]
    uniforms.uTreble.value = audioRefs.bands[4]
    uniforms.uAmplitude.value = audioRefs.amplitude
    uniforms.uHue.value = hue
    uniforms.uIntensity.value = intensity * getModulatedValue(config.id, 'opacity', config.opacity, 0, 1)
    uniforms.uSpeed.value = speed

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
            ? getModulatedValue(config.id, modPath, base, def.min ?? -100, def.max ?? 100)
            : def.value
        }
      }
    }

    // Update resolution
    const size = state.size
      ; (uniforms.uResolution.value as THREE.Vector2).set(size.width * state.viewport.dpr, size.height * state.viewport.dpr)
  })

  // Key includes blendMode (existing) + shader sources so the material
  // is fully disposed and re-compiled whenever the user edits code.
  const materialKey = `${config.blendMode}|${config.vertexShader}|${config.fragmentShader}`

  return (
    <mesh ref={meshRef} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={config.vertexShader}
        fragmentShader={config.fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        key={materialKey}
        {...(getBlendJSXProps(config.blendMode) as object)}
      />
    </mesh>
  )
}
