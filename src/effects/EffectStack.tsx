import { usePresetStore } from '../engine/store'
import { EffectComposer } from '@react-three/postprocessing'
import { PostProcessingEffects } from '../layers/PostProcessing'
import { MirrorFXEffects } from '../layers/MirrorFX'
import type { PostProcessingLayer, MirrorFXLayer } from '../types/layers'

/**
 * EffectStack — renders post-processing chains like Bloom, Chromatic Aberration, and Mirrors.
 */
export function EffectStack() {
    const activePreset = usePresetStore((s) => s.presets[s.activePresetId])
    if (!activePreset) return null

    const ppLayers = activePreset.layers.filter(
        (l): l is PostProcessingLayer => l.type === 'post-processing' && l.visible,
    )
    const mirrorLayers = activePreset.layers.filter(
        (l): l is MirrorFXLayer => l.type === 'mirror-fx' && l.visible,
    )
    const effects = [
        ...ppLayers.map((l) => <PostProcessingEffects key={l.id} config={l} />),
        ...mirrorLayers.map((l) => <MirrorFXEffects key={l.id} config={l} />),
    ]

    if (effects.length === 0) return null

    return (
        <EffectComposer multisampling={0}>
            <>{effects}</>
        </EffectComposer>
    )
}
