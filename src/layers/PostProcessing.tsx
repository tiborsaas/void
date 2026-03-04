import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
    Bloom,
    ChromaticAberration,
    Vignette,
    Noise,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { audioRefs } from '../engine/store'
import { getModulatedValue } from '../engine/ModulationEngine'
import type { PostProcessingLayer } from '../types/layers'
import * as THREE from 'three'

interface Props {
    config: PostProcessingLayer
}

/**
 * PostProcessing layer — renders the post-processing effect chain.
 * Audio-reactive modulation of chromatic aberration and bloom.
 */
export function PostProcessingEffects({ config }: Props) {
    const chromaticOffset = useRef(new THREE.Vector2(config.chromaticOffset, config.chromaticOffset))
    const bloomIntensityRef = useRef(config.bloomIntensity)

    useFrame(() => {
        const id = config.id
        if (config.chromaticEnabled) {
            const modChroma = getModulatedValue(id, 'chromaticOffset', config.chromaticOffset, 0, 0.05)
            const base = config.audioReactive
                ? modChroma + audioRefs.amplitude * 0.005 + (audioRefs.beat ? 0.01 : 0)
                : modChroma
            chromaticOffset.current.set(base, base)
        }
        if (config.bloomEnabled) {
            const modBloom = getModulatedValue(id, 'bloomIntensity', config.bloomIntensity, 0, 5)
            bloomIntensityRef.current = config.audioReactive
                ? modBloom + audioRefs.amplitude * 0.5
                : modBloom
        }
    })

    const effects: React.JSX.Element[] = []

    if (config.bloomEnabled) {
        effects.push(
            <Bloom
                key="bloom"
                intensity={bloomIntensityRef.current}
                luminanceThreshold={config.bloomThreshold}
                luminanceSmoothing={config.bloomRadius}
                mipmapBlur
            />,
        )
    }
    if (config.chromaticEnabled) {
        effects.push(
            <ChromaticAberration
                key="chromatic"
                offset={chromaticOffset.current}
                radialModulation={false}
                modulationOffset={0}
                blendFunction={BlendFunction.NORMAL}
            />,
        )
    }
    if (config.vignetteEnabled) {
        effects.push(
            <Vignette
                key="vignette"
                darkness={config.vignetteDarkness}
                offset={config.vignetteOffset}
                blendFunction={BlendFunction.NORMAL}
            />,
        )
    }
    if (config.noiseEnabled) {
        effects.push(
            <Noise
                key="noise"
                premultiply
                blendFunction={BlendFunction.ADD}
                opacity={config.noiseOpacity}
            />,
        )
    }

    if (effects.length === 0) return null

    return <>{effects}</>
}
