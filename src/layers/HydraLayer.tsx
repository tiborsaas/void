import { useRef, useEffect, useMemo, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlobalStore, audioRefs } from '../engine/store'
import { getBlendJSXProps } from '../utils/blendUtils'
import type { HydraLayer as HydraLayerConfig, HydraProjection } from '../types/layers'

interface Props {
    config: HydraLayerConfig
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HydraInstance = any

// ─── Geometry factory (same projections as Primitive3D) ───────────────────────

function createProjectionGeometry(projection: HydraProjection): THREE.BufferGeometry {
    switch (projection) {
        case 'plane':
            return new THREE.PlaneGeometry(1, 1, 1, 1)
        case 'sphere':
            return new THREE.SphereGeometry(1, 64, 64)
        case 'box':
            return new THREE.BoxGeometry(1, 1, 1)
        case 'torus':
            return new THREE.TorusGeometry(1, 0.35, 32, 128)
        case 'torusKnot':
            return new THREE.TorusKnotGeometry(0.8, 0.25, 256, 32)
        case 'cylinder':
            return new THREE.CylinderGeometry(0.8, 0.8, 2, 64, 1, true)
        default:
            return new THREE.PlaneGeometry(1, 1)
    }
}

// ─── Safe code evaluator in Hydra synth scope ─────────────────────────────────

function evalHydraCode(code: string, synth: HydraInstance) {
    if (!synth || !code.trim()) return
    try {
        // Destructure every public synth function/buffer so user code reads like
        // native Hydra (osc(...).out() style) without polluting window
        const {
            src, osc, gradient, shape, voronoi, noise,
            solid, prev,
            o0, o1, o2, o3,
            s0, s1, s2, s3,
            render, setResolution, hush, speed, bpm, mouse,
        } = synth
        // Create a scoped function so 'time' and 'synth' are available too
        const time = synth.time ?? 0
        // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
        const fn = new Function(
            'src', 'osc', 'gradient', 'shape', 'voronoi', 'noise', 'solid', 'prev',
            'o0', 'o1', 'o2', 'o3', 's0', 's1', 's2', 's3',
            'render', 'setResolution', 'hush', 'speed', 'bpm', 'mouse', 'time', 'synth',
            `"use strict";\n${code}`,
        )
        fn(
            src, osc, gradient, shape, voronoi, noise, solid, prev,
            o0, o1, o2, o3, s0, s1, s2, s3,
            render, setResolution, hush, speed, bpm, mouse, time, synth,
        )
    } catch (err) {
        console.warn('[HydraLayer] Code evaluation error:', err)
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * HydraLayer — renders Hydra visuals onto an offscreen canvas, then projects
 * the result as a THREE.CanvasTexture onto the selected 3D mesh.
 *
 * Hydra runs in its own WebGL context; Three.js reads it back each frame via
 * CanvasTexture (DOM drawImage path). autoLoop is disabled so R3F drives the
 * timing — keeping Hydra in sync with the rest of the scene.
 */
export function HydraLayer({ config }: Props) {
    const meshRef = useRef<THREE.Mesh>(null)
    const hydraRef = useRef<HydraInstance>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const textureRef = useRef<THREE.CanvasTexture | null>(null)
    const lastCodeRef = useRef<string>('')
    const beatAccum = useRef(0)
    const { viewport } = useThree()

    // ─── Create Hydra instance once, or when resolution changes ────────────────
    useEffect(() => {
        const [w, h] = config.resolution

        // Tear down previous instance if it exists
        if (hydraRef.current) {
            try { hydraRef.current.synth?.hush?.() } catch { /* ignore */ }
            hydraRef.current = null
        }
        if (textureRef.current) {
            textureRef.current.dispose()
            textureRef.current = null
        }

        // Use an offscreen OffscreenCanvas when available, otherwise a regular canvas
        let canvas: HTMLCanvasElement
        canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvasRef.current = canvas

        // Dynamically import Hydra to avoid SSR issues
        import('hydra-synth').then(({ default: Hydra }) => {
            const instance = new Hydra({
                canvas,
                width: w,
                height: h,
                makeGlobal: false,
                autoLoop: false,
                detectAudio: false,
                numSources: 4,
                numOutputs: 4,
            })
            hydraRef.current = instance

            // Create the texture from the hydra canvas
            const tex = new THREE.CanvasTexture(canvas)
            tex.colorSpace = THREE.SRGBColorSpace
            tex.minFilter = THREE.LinearFilter
            tex.magFilter = THREE.LinearFilter
            textureRef.current = tex

            // Apply to existing mesh material if already mounted
            if (meshRef.current) {
                const mat = meshRef.current.material as THREE.MeshBasicMaterial
                mat.map = tex
                mat.needsUpdate = true
            }

            // Evaluate the initial code
            evalHydraCode(config.code, instance.synth)
            lastCodeRef.current = config.code
        }).catch((err) => {
            console.error('[HydraLayer] Failed to load hydra-synth:', err)
        })

        return () => {
            textureRef.current?.dispose()
            textureRef.current = null
            hydraRef.current = null
            canvasRef.current = null
        }
        // Re-run when resolution changes (width or height)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.resolution[0], config.resolution[1]])

    // ─── Re-evaluate code when it changes ──────────────────────────────────────
    useEffect(() => {
        if (config.code === lastCodeRef.current) return
        lastCodeRef.current = config.code
        if (hydraRef.current?.synth) {
            try { hydraRef.current.synth.hush?.() } catch { /* ignore */ }
            evalHydraCode(config.code, hydraRef.current.synth)
        }
    }, [config.code])

    // ─── Geometry — recreate when projection changes ───────────────────────────
    const geometry = useMemo(
        () => createProjectionGeometry(config.projection),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [config.projection],
    )

    // ─── Scale: plane fills viewport, others use config scale ─────────────────
    const getBaseScale = useCallback(() => {
        if (config.projection === 'plane') {
            // Match the viewport so the plane behaves like a fullscreen layer
            return [viewport.width, viewport.height, 1] as [number, number, number]
        }
        return [config.scale, config.scale, config.scale] as [number, number, number]
    }, [config.projection, config.scale, viewport.width, viewport.height])

    // ─── Per-frame: tick Hydra + upload texture + animate mesh ────────────────
    useFrame((_, delta) => {
        const speed = useGlobalStore.getState().masterSpeed
        const intensity = useGlobalStore.getState().masterIntensity

        // Tick Hydra with wall-clock delta (in ms) adjusted by masterSpeed
        if (hydraRef.current) {
            hydraRef.current.tick(delta * 1000 * speed)
        }

        if (textureRef.current) {
            textureRef.current.needsUpdate = true
        }

        const mesh = meshRef.current
        if (!mesh) return

        // Audio reactivity
        if (audioRefs.beat) beatAccum.current = 1.0
        beatAccum.current *= 0.9

        // Rotation — accumulate every frame
        mesh.rotation.x += config.rotationSpeed[0] * speed * 0.01
        mesh.rotation.y += config.rotationSpeed[1] * speed * 0.01
        mesh.rotation.z += config.rotationSpeed[2] * speed * 0.01

        if (config.projection === 'plane') {
            const [sw, sh] = getBaseScale()
            mesh.scale.set(sw, sh, 1)
        } else {
            const s = config.audioReactive
                ? config.scale * (1 + beatAccum.current * 0.2 + audioRefs.amplitude * 0.1) * intensity
                : config.scale
            mesh.scale.setScalar(s)
        }

        mesh.position.set(...config.position)

        // Opacity driven by intensity
        const mat = mesh.material as THREE.MeshBasicMaterial
        if (mat) mat.opacity = config.opacity * intensity
    })

    // MeshBasicMaterial: no lighting needed — texture is self-lit
    const blendProps = getBlendJSXProps(config.blendMode)

    return (
        <mesh
            ref={meshRef}
            geometry={geometry}
            position={config.position}
            rotation={config.rotation}
            key={`${config.projection}|${config.blendMode}`}
        >
            <meshBasicMaterial
                map={textureRef.current ?? undefined}
                transparent
                opacity={config.opacity}
                side={THREE.DoubleSide}
                {...blendProps}
                key={config.blendMode}
            />
        </mesh>
    )
}
