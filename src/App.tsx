import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Conductor } from './engine/Conductor'
import { EffectStack } from './effects/EffectStack'
import { KeyboardController } from './controls/KeyboardController'
import { useAudioInit } from './hooks/useAudio'
import { usePresetStore } from './engine/store'
import { SceneBar } from './ui/SceneBar'
import { SceneEditor } from './ui/SceneEditor'
import { SceneManager } from './ui/SceneManager'
import { AudioMonitor } from './ui/AudioMonitor'
import { factoryPresets } from './presets/factory'
import './ui/ui.css'

function AudioInitializer() {
  useAudioInit()
  return null
}

export default function App() {
  // Seed factory presets only on first-ever run (empty store).
  // After that, users own their project — factory scenes can be renamed,
  // deleted, or replaced via Save/Load without being overwritten on reload.
  useEffect(() => {
    const stored = usePresetStore.getState().presets
    if (Object.keys(stored).length === 0) {
      usePresetStore.getState().registerPresets(factoryPresets)
    }
  }, [])

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 0, 5] }}
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
      >
        <AudioInitializer />
        <Conductor />
        <EffectStack />
      </Canvas>

      {/* DOM overlay — custom UI */}
      <SceneBar />
      <SceneManager />
      <SceneEditor />
      <AudioMonitor />
      <KeyboardController />
    </>
  )
}
