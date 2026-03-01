import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlobalStore, audioRefs } from '../engine/store'
import { getBlendJSXProps } from '../utils/blendUtils'
import type { FBOSimulationLayer, FBOSeedPattern } from '../types/layers'

interface Props {
  config: FBOSimulationLayer
}

const PASSTHROUGH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

// ─── Seed pattern generators ─────────────────────────────────────────

/**
 * Generate initial seed data for the FBO simulation.
 *
 * @param pattern - The seeding strategy to use:
 *   - `'random-spots'`: Fill with chemical A, scatter small circular B-spots randomly.
 *   - `'center-seed'`: Fill with A, place a single large B-spot in the center.
 *   - `'gradient'`: Smooth X/Y gradient across R and G channels.
 *   - `'noise'`: Per-pixel random values in R and G channels.
 * @param size - Width and height of the square texture (in pixels).
 * @returns A Float32Array of length `size * size * 4` with RGBA float data.
 */
function generateSeedData(pattern: FBOSeedPattern, size: number): Float32Array {
  const data = new Float32Array(size * size * 4)

  switch (pattern) {
    case 'random-spots': {
      // Default reaction-diffusion seeding: fill with A=1, then sprinkle B spots
      for (let i = 0; i < size * size; i++) {
        data[i * 4] = 1.0
        data[i * 4 + 1] = 0.0
        data[i * 4 + 2] = 0.0
        data[i * 4 + 3] = 1.0
      }
      for (let s = 0; s < 20; s++) {
        const cx = Math.floor(Math.random() * size)
        const cy = Math.floor(Math.random() * size)
        const r = 5
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy < r * r) {
              const x = (cx + dx + size) % size
              const y = (cy + dy + size) % size
              const idx = (y * size + x) * 4
              data[idx + 1] = 1.0
            }
          }
        }
      }
      break
    }
    case 'center-seed': {
      // Single large seed in the center — good for radial simulations
      for (let i = 0; i < size * size; i++) {
        data[i * 4] = 1.0
        data[i * 4 + 3] = 1.0
      }
      const cx = Math.floor(size / 2)
      const cy = Math.floor(size / 2)
      const r = Math.floor(size * 0.06)
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy < r * r) {
            const x = (cx + dx + size) % size
            const y = (cy + dy + size) % size
            const idx = (y * size + x) * 4
            data[idx + 1] = 1.0
          }
        }
      }
      break
    }
    case 'gradient': {
      // Smooth gradient — useful for fluid / heat-map simulations
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4
          data[idx] = x / size
          data[idx + 1] = y / size
          data[idx + 2] = 0.0
          data[idx + 3] = 1.0
        }
      }
      break
    }
    case 'noise': {
      // Per-pixel random values — good for noise-driven simulations
      for (let i = 0; i < size * size; i++) {
        data[i * 4] = Math.random()
        data[i * 4 + 1] = Math.random()
        data[i * 4 + 2] = 0.0
        data[i * 4 + 3] = 1.0
      }
      break
    }
  }

  return data
}

// ─── Component ───────────────────────────────────────────────────────

/**
 * FBOSimulation — ping-pong FBO simulation with compute + display pass.
 * Used for reaction-diffusion (Membrane) and similar GPU simulations.
 *
 * The `seedPattern` field selects the initial state written into the
 * first render-target before the compute loop begins.
 */
// Minimal fallback shaders so the material compiles even when config shaders
// are empty (can happen when localStorage is stale on first frame).
const _FALLBACK_FRAGMENT = /* glsl */ `
  void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }
`
void _FALLBACK_FRAGMENT

export function FBOSimulation({ config }: Props) {
  const displayRef = useRef<THREE.Mesh>(null)
  const beatAccum = useRef(0)
  const initialized = useRef(false)
  const frameIndex = useRef(0)

  // Reset simulation whenever seed pattern or resolution changes
  useEffect(() => {
    initialized.current = false
    frameIndex.current = 0
  }, [config.seedPattern, config.size])

  // If shaders are missing, render nothing.  The preset store will be fixed
  // on the next React commit and trigger a re-mount with valid shaders.
  // const hasShaders = !!(config.computeShader && config.displayShader)
  // if (!hasShaders) return null

  const size = config.size

  const renderTargets = useMemo(() => {
    const options: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    }
    return [
      new THREE.WebGLRenderTarget(size, size, options),
      new THREE.WebGLRenderTarget(size, size, options),
    ]
  }, [size])

  const computeScene = useMemo(() => new THREE.Scene(), [])
  const computeCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])

  const seedScene = useMemo(() => {
    const scene = new THREE.Scene()
    const geoSquare = new THREE.PlaneGeometry(0.1, 0.1)
    const geoCircle = new THREE.CircleGeometry(0.05, 32)
    // Reaction-diffusion expects chemical B in the green channel
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0, 1, 0),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      opacity: 1.0
    })

    const square = new THREE.Mesh(geoSquare, mat)
    const circle = new THREE.Mesh(geoCircle, mat)
    scene.add(square)
    scene.add(circle)
    return scene
  }, [])
  const lastSeedTime = useRef(0)

  const computeUniforms = useMemo(() => {
    const u: Record<string, { value: unknown }> = {
      uPrevState: { value: null },
      uResolution: { value: new THREE.Vector2(size, size) },
      uDeltaTime: { value: 1.0 },
      uBass: { value: 0 },
      uTreble: { value: 0 },
      uAmplitude: { value: 0 },
      uBeat: { value: 0 },
      uTime: { value: 0 },
    }
    if (config.audioInject) {
      u.uAudioInject = { value: new Float32Array(8) }
      u.uInjectStrength = { value: 0 }
    }
    if (config.computeUniforms) {
      for (const [key, def] of Object.entries(config.computeUniforms)) {
        u[key] = { value: def.value }
      }
    }
    return u
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id, size])

  const displayUniforms = useMemo(() => {
    const u: Record<string, { value: unknown }> = {
      uState: { value: null },
      uHue: { value: 0 },
      uIntensity: { value: 1 },
      uBeat: { value: 0 },
    }
    if (config.displayUniforms) {
      for (const [key, def] of Object.entries(config.displayUniforms)) {
        u[key] = { value: def.value }
      }
    }
    return u
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id])

  // Build compute scene
  const computeMesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2, 2)
    const mat = new THREE.ShaderMaterial({
      vertexShader: PASSTHROUGH_VERTEX,
      fragmentShader: config.computeShader,
      uniforms: computeUniforms,
    })
    const mesh = new THREE.Mesh(geo, mat)
    computeScene.add(mesh)
    return mesh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id, computeScene, computeUniforms])

  useFrame((state, delta) => {
    const { gl } = state
    const speed = useGlobalStore.getState().masterSpeed
    const hue = useGlobalStore.getState().masterHue
    const intensity = useGlobalStore.getState().masterIntensity

    // Initialize with seed data using the configured pattern
    if (!initialized.current) {
      const data = generateSeedData(config.seedPattern, size)
      const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType)
      texture.colorSpace = ''  // keep linear — no sRGB transform
      texture.needsUpdate = true

      // Use a raw ShaderMaterial so float values are copied without encoding
      const tmpScene = new THREE.Scene()
      const tmpGeo = new THREE.PlaneGeometry(2, 2)
      const tmpMat = new THREE.ShaderMaterial({
        vertexShader: PASSTHROUGH_VERTEX,
        fragmentShader: /* glsl */ `
          uniform sampler2D uSeed;
          varying vec2 vUv;
          void main() { gl_FragColor = texture2D(uSeed, vUv); }
        `,
        uniforms: { uSeed: { value: texture } },
      })
      const tmpMesh = new THREE.Mesh(tmpGeo, tmpMat)
      tmpScene.add(tmpMesh)
      gl.setRenderTarget(renderTargets[0])
      gl.render(tmpScene, computeCamera)
      gl.setRenderTarget(renderTargets[1])
      gl.render(tmpScene, computeCamera)
      gl.setRenderTarget(null)
      tmpGeo.dispose()
      tmpMat.dispose()
      texture.dispose()
      initialized.current = true
    }

    // Update compute uniforms
    computeUniforms.uBass.value = audioRefs.bands[0]
    computeUniforms.uTreble.value = audioRefs.bands[4]
    computeUniforms.uAmplitude.value = audioRefs.amplitude
    computeUniforms.uDeltaTime.value = Math.min(delta * speed * 60, 3.0)
    computeUniforms.uTime.value = state.clock.elapsedTime

    if (audioRefs.beat) beatAccum.current = 1.0
    beatAccum.current *= 0.9
    computeUniforms.uBeat.value = beatAccum.current

    // Wire audio injection points when enabled
    if (config.audioInject && computeUniforms.uAudioInject && computeUniforms.uInjectStrength) {
      if (audioRefs.beat) {
        const injectArr = computeUniforms.uAudioInject.value as Float32Array
        const slot = Math.floor(Math.random() * 4)
        injectArr[slot * 2] = Math.random()
        injectArr[slot * 2 + 1] = Math.random()
        computeUniforms.uInjectStrength.value = 0.8 + audioRefs.bands[0] * 0.5
      } else {
        const prev = computeUniforms.uInjectStrength.value as number
        computeUniforms.uInjectStrength.value = Math.max(0, prev - 0.05)
      }
    }

    // Ping-pong compute passes
    const steps = config.stepsPerFrame
    for (let i = 0; i < steps; i++) {
      const readIdx = (frameIndex.current + i) % 2
      const writeIdx = 1 - readIdx
      computeUniforms.uPrevState.value = renderTargets[readIdx].texture
      gl.setRenderTarget(renderTargets[writeIdx])
      gl.render(computeScene, computeCamera)
    }
    frameIndex.current = (frameIndex.current + steps) % 2

    // Seed periodically to sustain reaction
    if (state.clock.elapsedTime - lastSeedTime.current > 1.0) {
      lastSeedTime.current = state.clock.elapsedTime
      seedScene.children.forEach(child => {
        child.position.x = (Math.random() - 0.5) * 1.8
        child.position.y = (Math.random() - 0.5) * 1.8
        child.scale.setScalar(0.5 + Math.random())
        child.rotation.z = Math.random() * Math.PI
      })
      gl.setRenderTarget(renderTargets[frameIndex.current])
      gl.render(seedScene, computeCamera)
    }

    gl.setRenderTarget(null)

    // Display uniforms
    const displayIdx = frameIndex.current
    displayUniforms.uState.value = renderTargets[displayIdx].texture
    displayUniforms.uHue.value = hue
    displayUniforms.uIntensity.value = intensity * config.opacity
    displayUniforms.uBeat.value = beatAccum.current

    void computeMesh // keep alive
  })

  return (
    <mesh ref={displayRef} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={PASSTHROUGH_VERTEX}
        fragmentShader={config.displayShader}
        uniforms={displayUniforms}
        depthTest={false}
        depthWrite={false}
        key={config.blendMode}
        {...(getBlendJSXProps(config.blendMode) as object)}
      />
    </mesh>
  )
}
