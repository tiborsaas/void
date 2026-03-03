import { useEffect, useCallback } from 'react'
import { usePresetStore, useGlobalStore } from '../engine/store'
import type { TransitionType } from '../types'

const TRANSITION_TYPES: TransitionType[] = ['crossfade', 'dissolve', 'glitch-cut', 'zoom-blur', 'instant']

/**
 * KeyboardController — global keyboard bindings for live VJ control.
 * Mount once at app level.
 */
export function KeyboardController() {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Ignore if typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

        const presetStore = usePresetStore.getState()
        const globalStore = useGlobalStore.getState()

        // Number keys 1-9: switch presets
        if (e.key >= '1' && e.key <= '9') {
            const index = parseInt(e.key) - 1
            const presetList = Object.values(presetStore.presets)
            if (index < presetList.length) {
                const preset = presetList[index]
                if (preset.id !== presetStore.activePresetId) {
                    presetStore.startTransition(preset.id)
                }
            }
            return
        }

        switch (e.key.toLowerCase()) {
            case ' ':
                // Manual beat trigger
                e.preventDefault()
                break

            case 'f':
                // Fullscreen toggle
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => { })
                } else {
                    document.exitFullscreen()
                }
                break

            case 'e':
                // Toggle editor
                globalStore.toggleEditor()
                break

            case 'p':
                // Toggle scene manager
                globalStore.toggleSceneManager()
                break

            case 'a':
                // Toggle audio monitor
                globalStore.toggleAudioMonitor()
                break

            case 'h':
                // Toggle controls (scene bar visibility)
                globalStore.toggleControls()
                break

            case 't': {
                // Cycle transition type
                const currentType = presetStore.transitionType
                const currentIdx = TRANSITION_TYPES.indexOf(currentType)
                const nextIdx = (currentIdx + 1) % TRANSITION_TYPES.length
                usePresetStore.setState({ transitionType: TRANSITION_TYPES[nextIdx] })
                break
            }

            case '[':
                // Decrease master intensity
                globalStore.setMasterIntensity(Math.max(0, globalStore.masterIntensity - 0.1))
                break
            case ']':
                // Increase master intensity
                globalStore.setMasterIntensity(Math.min(3, globalStore.masterIntensity + 0.1))
                break

            case 'arrowleft':
                // Shift hue left
                globalStore.setMasterHue((globalStore.masterHue - 0.05 + 1) % 1)
                break
            case 'arrowright':
                // Shift hue right
                globalStore.setMasterHue((globalStore.masterHue + 0.05) % 1)
                break

            case 'arrowup':
                // Increase speed
                e.preventDefault()
                globalStore.setMasterSpeed(Math.min(3, globalStore.masterSpeed + 0.1))
                break
            case 'arrowdown':
                // Decrease speed
                e.preventDefault()
                globalStore.setMasterSpeed(Math.max(0.1, globalStore.masterSpeed - 0.1))
                break
        }
    }, [])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    return null // Renderless component
}
