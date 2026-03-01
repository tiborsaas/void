import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MirrorFX } from '../effects/MirrorFX'
import { MirrorEffectImpl } from '../effects/MirrorEffect'
import { audioRefs } from '../engine/store'
import type { MirrorFXLayer } from '../types/layers'

interface Props {
    config: MirrorFXLayer
}

export function MirrorFXEffects({ config }: Props) {
    const mirrorRef = useRef<MirrorEffectImpl | null>(null)

    useFrame(() => {
        if (!mirrorRef.current) return

        let dynamicAngle = config.angle

        if (config.audioReactive) {
            // Spin and bounce to the beat if kaleidoscope mode
            if (config.mode === 4) {
                dynamicAngle += audioRefs.amplitude * 0.5
                // optionally we could make sides dynamic too but maybe too glitchy
            }
        }

        mirrorRef.current.updateUniforms(config.mode, config.sides, dynamicAngle)
    })

    if (config.mode === 0) return null

    return <MirrorFX ref={mirrorRef} mode={config.mode} sides={config.sides} angle={config.angle} />
}
