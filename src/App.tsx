import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Conductor } from './engine/Conductor'
import { EffectStack } from './effects/EffectStack'
import { KeyboardController } from './controls/KeyboardController'
import { useAudioInit } from './hooks/useAudio'
import { usePresetStore } from './engine/store'
import { SceneBar } from './ui/SceneBar'
import { SceneEditor } from './ui/SceneEditor'
import { AudioMonitor } from './ui/AudioMonitor'
import { factoryPresets } from './presets/factory'
import './ui/ui.css'

function AudioInitializer() {
  useAudioInit()
  return null
}

export default function App() {
  // Always overwrite factory presets on mount so that shader code updates,
  // new layers, or config changes are picked up immediately — even when
  // localStorage contains a stale copy of the preset.
  // User-created presets (IDs not in the factory list) are never touched.
  useEffect(() => {
    usePresetStore.getState().registerPresets(factoryPresets)
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
      <SceneEditor />
      <AudioMonitor />
      <KeyboardController />
    </>
  )
}
