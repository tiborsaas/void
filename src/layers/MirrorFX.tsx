import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MirrorFX } from '../effects/MirrorFX'
import { MirrorEffectImpl } from '../effects/MirrorEffect'
import { audioRefs } from '../engine/store'
import { getModulatedValue } from '../engine/ModulationEngine'
import type { MirrorFXLayer } from '../types/layers'

interface Props {
    config: MirrorFXLayer
}

export function MirrorFXEffects({ config }: Props) {
    const mirrorRef = useRef<MirrorEffectImpl | null>(null)

    useFrame(() => {
        if (!mirrorRef.current) return
        const id = config.id

        let dynamicAngle = getModulatedValue(id, 'angle', config.angle, 0, Math.PI * 2)
        const modSides = Math.round(getModulatedValue(id, 'sides', config.sides, 2, 24))

        if (config.audioReactive) {
            if (config.mode === 4) {
                dynamicAngle += audioRefs.amplitude * 0.5
            }
        }

        mirrorRef.current.updateUniforms(config.mode, modSides, dynamicAngle)
    })

    if (config.mode === 0) return null

    return <MirrorFX ref={mirrorRef} mode={config.mode} sides={config.sides} angle={config.angle} />
}
