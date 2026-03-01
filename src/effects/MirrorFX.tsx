import { forwardRef, useImperativeHandle, useMemo } from 'react'
import { MirrorEffectImpl } from './MirrorEffect'

export type MirrorFXProps = {
    mode?: number
    sides?: number
    angle?: number
}

export const MirrorFX = forwardRef<MirrorEffectImpl, MirrorFXProps>(
    ({ mode = 1, sides = 6, angle = 0 }, ref) => {
        const effect = useMemo(
            () => new MirrorEffectImpl({ mode, sides, angle }),
            [mode, sides, angle],
        )

        useImperativeHandle(ref, () => effect, [effect])

        return <primitive object={effect} dispose={null} />
    },
)
