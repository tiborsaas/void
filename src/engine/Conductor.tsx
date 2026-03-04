import { useRef, useMemo, useState, useEffect, Suspense } from 'react'
import { useFrame, createPortal } from '@react-three/fiber'
import { useFBO } from '@react-three/drei'
import * as THREE from 'three'
import { usePresetStore } from './store'
import { SceneStack } from './SceneStack'
import { useAudio } from '../hooks/useAudio'
import { useClock } from '../hooks/useClock'
import { evaluateModulations } from './ModulationEngine'

// ─── Transition Shader ───────────────────────────────────────────────

const transitionVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

const transitionFragmentShader = /* glsl */ `
  uniform sampler2D tFrom;
  uniform sampler2D tTo;
  uniform float uProgress;
  uniform int uType; // 0=crossfade, 1=dissolve, 2=glitch-cut, 3=zoom-blur
  uniform float uTime;

  varying vec2 vUv;

  // Simple hash for dissolve
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec4 fromColor = texture2D(tFrom, vUv);
    vec4 toColor = texture2D(tTo, vUv);

    if (uType == 0) {
      // Crossfade
      gl_FragColor = mix(fromColor, toColor, uProgress);
    }
    else if (uType == 1) {
      // Dissolve — noise threshold
      float noise = hash(vUv * 100.0 + uTime);
      float threshold = uProgress;
      float edge = smoothstep(threshold - 0.05, threshold + 0.05, noise);
      gl_FragColor = mix(toColor, fromColor, edge);
    }
    else if (uType == 2) {
      // Glitch cut — scanline + RGB split
      float scanline = step(0.5, fract(vUv.y * 200.0 + uTime * 10.0));
      float glitchProgress = smoothstep(0.3, 0.7, uProgress);

      vec2 offset = vec2(
        (hash(vec2(floor(vUv.y * 30.0), uTime)) * 2.0 - 1.0) * 0.1 * (1.0 - abs(uProgress - 0.5) * 2.0),
        0.0
      );

      vec4 glitchFrom = texture2D(tFrom, vUv + offset);
      vec4 glitchTo = texture2D(tTo, vUv - offset);

      float rgbSplit = 0.01 * sin(uProgress * 3.14159);
      glitchFrom.r = texture2D(tFrom, vUv + offset + vec2(rgbSplit, 0.0)).r;
      glitchFrom.b = texture2D(tFrom, vUv + offset - vec2(rgbSplit, 0.0)).b;
      glitchTo.r = texture2D(tTo, vUv - offset + vec2(rgbSplit, 0.0)).r;
      glitchTo.b = texture2D(tTo, vUv - offset - vec2(rgbSplit, 0.0)).b;

      vec4 mixed = mix(glitchFrom, glitchTo, glitchProgress);
      mixed.rgb *= 0.9 + 0.1 * scanline;
      gl_FragColor = mixed;
    }
    else if (uType == 3) {
      // Zoom blur
      vec2 center = vec2(0.5);
      vec2 dir = vUv - center;
      float strength = sin(uProgress * 3.14159) * 0.1;

      vec4 blurred = vec4(0.0);
      for (int i = 0; i < 8; i++) {
        float t = float(i) / 8.0;
        vec2 sampleUV = vUv - dir * strength * t;
        blurred += mix(
          texture2D(tFrom, sampleUV),
          texture2D(tTo, sampleUV),
          uProgress
        );
      }
      gl_FragColor = blurred / 8.0;
    }
    else {
      // Instant
      gl_FragColor = uProgress > 0.5 ? toColor : fromColor;
    }
  }
`

const transitionTypeToInt: Record<string, number> = {
    crossfade: 0,
    dissolve: 1,
    'glitch-cut': 2,
    'zoom-blur': 3,
    instant: 4,
}

// ─── Conductor Component ─────────────────────────────────────────────

export function Conductor() {

    // Two persistent FBOs and virtual scenes — they never get recreated.
    const fboA = useFBO(1920, 1080, { samples: 0 })
    const fboB = useFBO(1920, 1080, { samples: 0 })
    const sceneA = useMemo(() => new THREE.Scene(), [])
    const sceneB = useMemo(() => new THREE.Scene(), [])

    // Tracks which slot currently holds the active (visible) scene.
    const activeSlot = useRef<'a' | 'b'>('a')

    // The preset ID rendered inside each slot.
    const [slotAId, setSlotAId] = useState<string>(() => usePresetStore.getState().activePresetId)
    const [slotBId, setSlotBId] = useState<string | null>(null)

    // Camera shared by both portals
    const sceneCamera = useMemo(() => {
        const cam = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000)
        cam.position.set(0, 0, 5)
        return cam
    }, [])

    // Fullscreen quad
    const quadGeometry = useMemo(() => new THREE.PlaneGeometry(2, 2), [])
    const transitionMaterial = useMemo(
        () =>
            new THREE.ShaderMaterial({
                vertexShader: transitionVertexShader,
                fragmentShader: transitionFragmentShader,
                uniforms: {
                    tFrom: { value: null },
                    tTo: { value: null },
                    uProgress: { value: 0 },
                    uType: { value: 0 },
                    uTime: { value: 0 },
                },
                depthTest: false,
                depthWrite: false,
            }),
        [],
    )

    const transitionRef = useRef({ startTime: 0, active: false })

    useAudio()
    useClock()

    // Store subscriptions
    const isTransitioning = usePresetStore((s) => s.isTransitioning)
    const nextPresetId = usePresetStore((s) => s.nextPresetId)
    const transitionType = usePresetStore((s) => s.transitionType)
    const transitionDuration = usePresetStore((s) => s.transitionDuration)

    // Resolve preset objects from IDs
    const slotAPreset = usePresetStore((s) => slotAId ? s.presets[slotAId] : null)
    const slotBPreset = usePresetStore((s) => slotBId ? s.presets[slotBId] : null)

    // When a transition starts, load the incoming preset into the INACTIVE slot
    useEffect(() => {
        if (isTransitioning && nextPresetId) {
            if (activeSlot.current === 'a') {
                setSlotBId(nextPresetId)
            } else {
                setSlotAId(nextPresetId)
            }
            transitionRef.current.active = false
        }
    }, [isTransitioning, nextPresetId])

    useFrame((state, delta) => {
        const { gl, camera } = state

        // Evaluate modulations before layers render
        const activePreset = usePresetStore.getState().presets[usePresetStore.getState().activePresetId]
        if (activePreset) {
            evaluateModulations(
                activePreset.modulations ?? [],
                state.clock.elapsedTime,
                delta,
            )
        }

        if ('aspect' in camera && camera.aspect !== sceneCamera.aspect) {
            sceneCamera.aspect = camera.aspect as number
            sceneCamera.updateProjectionMatrix()
        }

        const isActive = activeSlot.current
        const activeScene = isActive === 'a' ? sceneA : sceneB
        const inactiveScene = isActive === 'a' ? sceneB : sceneA
        const activeFbo = isActive === 'a' ? fboA : fboB
        const inactiveFbo = isActive === 'a' ? fboB : fboA

        gl.setRenderTarget(activeFbo)
        gl.clear()
        gl.render(activeScene, sceneCamera)

        let progress = 0
        if (isTransitioning) {
            if (!transitionRef.current.active) {
                transitionRef.current.active = true
                transitionRef.current.startTime = state.clock.elapsedTime
            }

            const elapsed = state.clock.elapsedTime - transitionRef.current.startTime
            progress = Math.min(elapsed / transitionDuration, 1.0)
            usePresetStore.getState().updateTransitionProgress(progress)

            gl.setRenderTarget(inactiveFbo)
            gl.clear()
            gl.render(inactiveScene, sceneCamera)

            if (progress >= 1.0) {
                activeSlot.current = activeSlot.current === 'a' ? 'b' : 'a'
                transitionRef.current.active = false
                usePresetStore.getState().completeTransition()
            }
        }

        gl.setRenderTarget(null)

        transitionMaterial.uniforms.tFrom.value = activeFbo.texture
        transitionMaterial.uniforms.tTo.value = isTransitioning ? inactiveFbo.texture : activeFbo.texture
        transitionMaterial.uniforms.uProgress.value = progress
        transitionMaterial.uniforms.uType.value = transitionTypeToInt[transitionType] ?? 0
        transitionMaterial.uniforms.uTime.value = state.clock.elapsedTime
    })

    return (
        <>
            {/* Slot A — always mounted, renders SceneStack from preset */}
            {createPortal(
                <Suspense fallback={null}>
                    {slotAPreset && <SceneStack preset={slotAPreset} />}
                </Suspense>,
                sceneA,
            )}

            {/* Slot B — mounted when a transition target is assigned */}
            {slotBId && slotBPreset && createPortal(
                <Suspense fallback={null}>
                    <SceneStack preset={slotBPreset} />
                </Suspense>,
                sceneB,
            )}

            {/* Single fullscreen quad */}
            <mesh geometry={quadGeometry} material={transitionMaterial} frustumCulled={false} renderOrder={999} />
        </>
    )
}
