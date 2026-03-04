import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { audioRefs } from '../engine/store'
import { getModulatedValue, getModulatedColor } from '../engine/ModulationEngine'
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
        const id = config.id

        const modBeatInt = getModulatedValue(id, 'beatIntensity', config.beatIntensity, 0, 3)
        const modOpacity = getModulatedValue(id, 'opacity', config.opacity, 0, 1)

        const beatMul = config.audioReactive
            ? 1 + beatAccum.current * modBeatInt + audioRefs.amplitude * (modBeatInt * 0.4)
            : 1

        if (ambientRef.current && config.ambientEnabled) {
            const modAmbInt = getModulatedValue(id, 'ambientIntensity', config.ambientIntensity, 0, 5)
            ambientRef.current.intensity = modAmbInt * beatMul * modOpacity
            const ambColor = getModulatedColor(id, 'ambientColor', config.ambientColor)
            ambientRef.current.color.set(ambColor)
        }

        config.dirLights.forEach((dl, i) => {
            const ref = dirRefs.current[i]
            if (ref && dl.enabled) {
                const modInt = getModulatedValue(id, `dirLights.${i}.intensity`, dl.intensity, 0, 5)
                ref.intensity = modInt * beatMul * modOpacity
                const modCol = getModulatedColor(id, `dirLights.${i}.color`, dl.color)
                ref.color.set(modCol)
                const modPx = getModulatedValue(id, `dirLights.${i}.position.0`, dl.position[0], -20, 20)
                const modPy = getModulatedValue(id, `dirLights.${i}.position.1`, dl.position[1], -20, 20)
                const modPz = getModulatedValue(id, `dirLights.${i}.position.2`, dl.position[2], -20, 20)
                ref.position.set(modPx, modPy, modPz)
            }
        })

        config.pointLights.forEach((pl, i) => {
            const ref = pointRefs.current[i]
            if (ref && pl.enabled) {
                const modInt = getModulatedValue(id, `pointLights.${i}.intensity`, pl.intensity, 0, 10)
                ref.intensity = modInt * beatMul * modOpacity
                const modCol = getModulatedColor(id, `pointLights.${i}.color`, pl.color)
                ref.color.set(modCol)
                const modPx = getModulatedValue(id, `pointLights.${i}.position.0`, pl.position[0], -20, 20)
                const modPy = getModulatedValue(id, `pointLights.${i}.position.1`, pl.position[1], -20, 20)
                const modPz = getModulatedValue(id, `pointLights.${i}.position.2`, pl.position[2], -20, 20)
                ref.position.set(modPx, modPy, modPz)
                ref.distance = getModulatedValue(id, `pointLights.${i}.distance`, pl.distance, 0, 50)
                ref.decay = getModulatedValue(id, `pointLights.${i}.decay`, pl.decay, 0, 4)
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
