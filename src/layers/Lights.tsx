import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audioRefs } from '../engine/store'
import type { LightsLayer } from '../types/layers'

interface Props {
    config: LightsLayer
}

/**
 * Lights — scene lighting layer.
 * Adds ambient, directional, and point lights to the scene.
 * When audioReactive is on, all intensities pulse on beat.
 */
export function Lights({ config }: Props) {
    const beatAccum = useRef(0)
    const ambientRef = useRef<THREE.AmbientLight>(null)
    const dirRefs = useRef<(THREE.DirectionalLight | null)[]>([])
    const pointRefs = useRef<(THREE.PointLight | null)[]>([])

    useFrame(() => {
        if (audioRefs.beat) beatAccum.current = 1.0
        beatAccum.current *= 0.88

        const beatMul = config.audioReactive
            ? 1 + beatAccum.current * config.beatIntensity + audioRefs.amplitude * (config.beatIntensity * 0.4)
            : 1

        if (ambientRef.current && config.ambientEnabled) {
            ambientRef.current.intensity = config.ambientIntensity * beatMul * config.opacity
        }

        config.dirLights.forEach((dl, i) => {
            const ref = dirRefs.current[i]
            if (ref && dl.enabled) {
                ref.intensity = dl.intensity * beatMul * config.opacity
            }
        })

        config.pointLights.forEach((pl, i) => {
            const ref = pointRefs.current[i]
            if (ref && pl.enabled) {
                ref.intensity = pl.intensity * beatMul * config.opacity
            }
        })
    })

    return (
        <group>
            {config.ambientEnabled && (
                <ambientLight
                    ref={ambientRef}
                    color={config.ambientColor}
                    intensity={config.ambientIntensity}
                />
            )}

            {config.dirLights.map((dl, i) =>
                dl.enabled ? (
                    <directionalLight
                        key={i}
                        ref={(el) => { dirRefs.current[i] = el }}
                        color={dl.color}
                        intensity={dl.intensity}
                        position={dl.position}
                    />
                ) : null,
            )}

            {config.pointLights.map((pl, i) =>
                pl.enabled ? (
                    <pointLight
                        key={i}
                        ref={(el) => { pointRefs.current[i] = el }}
                        color={pl.color}
                        intensity={pl.intensity}
                        position={pl.position}
                        distance={pl.distance}
                        decay={pl.decay}
                    />
                ) : null,
            )}
        </group>
    )
}
