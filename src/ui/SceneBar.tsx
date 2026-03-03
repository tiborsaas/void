import { usePresetStore, useGlobalStore } from '../engine/store'
import type { TransitionType } from '../types'
import '../ui/ui.css'

const TRANSITION_TYPES: TransitionType[] = ['crossfade', 'dissolve', 'glitch-cut', 'zoom-blur', 'instant']

/**
 * SceneBar — slim persistent bottom strip.
 * Shows numbered scene shortcuts for quick switching + toolbar buttons.
 * Full scene management is in the floating SceneManager panel (◉).
 */
export function SceneBar() {
    const presets = usePresetStore((s) => s.presets)
    const activePresetId = usePresetStore((s) => s.activePresetId)
    const nextPresetId = usePresetStore((s) => s.nextPresetId)
    const isTransitioning = usePresetStore((s) => s.isTransitioning)
    const startTransition = usePresetStore((s) => s.startTransition)
    const transitionType = usePresetStore((s) => s.transitionType)
    const editorOpen = useGlobalStore((s) => s.editorOpen)
    const audioMonitorOpen = useGlobalStore((s) => s.audioMonitorOpen)
    const sceneManagerOpen = useGlobalStore((s) => s.sceneManagerOpen)
    const toggleEditor = useGlobalStore((s) => s.toggleEditor)
    const toggleAudioMonitor = useGlobalStore((s) => s.toggleAudioMonitor)
    const toggleSceneManager = useGlobalStore((s) => s.toggleSceneManager)

    const presetList = Object.values(presets)

    const cycleTransition = () => {
        const currentIdx = TRANSITION_TYPES.indexOf(transitionType)
        const nextIdx = (currentIdx + 1) % TRANSITION_TYPES.length
        usePresetStore.setState({ transitionType: TRANSITION_TYPES[nextIdx] })
    }

    return (
        <div className="scene-bar">
            {/* Scene shortcut chips */}
            {presetList.map((preset, index) => {
                const isActive = preset.id === activePresetId
                const isNext = preset.id === nextPresetId
                let cls = 'scene-bar__chip'
                if (isActive) cls += ' scene-bar__chip--active'
                if (isNext && isTransitioning) cls += ' scene-bar__chip--transitioning'

                return (
                    <button
                        key={preset.id}
                        className={cls}
                        title={preset.name}
                        onClick={() => {
                            if (!isActive) startTransition(preset.id)
                        }}
                    >
                        <span className="scene-bar__chip-key">{index + 1}</span>
                        <span className="scene-bar__chip-name">
                            {preset.name.length > 12 ? preset.name.slice(0, 11) + '…' : preset.name}
                        </span>
                    </button>
                )
            })}

            {/* Right-side toolbar */}
            <div className="scene-bar__controls">
                <button
                    className={`scene-bar__btn ${sceneManagerOpen ? 'scene-bar__btn--active' : ''}`}
                    onClick={toggleSceneManager}
                    title="Scene Manager (P)"
                >
                    ◉
                </button>
                <button
                    className={`scene-bar__btn ${editorOpen ? 'scene-bar__btn--active' : ''}`}
                    onClick={toggleEditor}
                    title="Scene Editor (E)"
                >
                    ✎
                </button>
                <button
                    className={`scene-bar__btn ${audioMonitorOpen ? 'scene-bar__btn--active' : ''}`}
                    onClick={toggleAudioMonitor}
                    title="Audio Monitor (A)"
                >
                    ♫
                </button>
                <button
                    className="scene-bar__btn"
                    onClick={cycleTransition}
                    title={`Transition: ${transitionType}`}
                >
                    ⇌
                </button>
                <button
                    className="scene-bar__btn"
                    onClick={() => {
                        if (!document.fullscreenElement) {
                            document.documentElement.requestFullscreen().catch(() => { })
                        } else {
                            document.exitFullscreen()
                        }
                    }}
                    title="Fullscreen (F)"
                >
                    ⛶
                </button>
            </div>
        </div>
    )
}
