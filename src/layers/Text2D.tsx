import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useGlobalStore, audioRefs } from '../engine/store'
import { getModulatedValue, getModulatedColor } from '../engine/ModulationEngine'
import { getThreeBlending } from '../utils/blendUtils'
import type { Text2DLayer } from '../types/layers'

interface Props {
  config: Text2DLayer
}

/**
 * Text2D — screen-space text rendered via drei's Text (SDF/MSDF).
 * Supports audio-reactive scale, opacity, position, and rotation.
 */
export function Text2D({ config }: Props) {
  const textRef = useRef<THREE.Mesh>(null)
  const beatAccum = useRef(0)

  useFrame(() => {
    if (!textRef.current) return

    const intensity = useGlobalStore.getState().masterIntensity
    const id = config.id

    if (audioRefs.beat) beatAccum.current = 1.0
    beatAccum.current *= 0.9

    const modPosX = getModulatedValue(id, 'position.0', config.position[0], -10, 10)
    const modPosY = getModulatedValue(id, 'position.1', config.position[1], -10, 10)
    const modRot = getModulatedValue(id, 'rotation', config.rotation, -Math.PI, Math.PI)
    const modOpacity = getModulatedValue(id, 'opacity', config.opacity, 0, 1)
    const modFontSize = getModulatedValue(id, 'fontSize', config.fontSize, 0.1, 5)
    const baseFontScale = modFontSize / config.fontSize

    textRef.current.position.x = modPosX
    textRef.current.position.y = modPosY
    textRef.current.rotation.z = modRot
    textRef.current.scale.setScalar(baseFontScale)

    if (config.audioReactive) {
      switch (config.audioProperty) {
        case 'scale': {
          const audioScale = 1 + audioRefs.amplitude * 0.5 + beatAccum.current * 0.3
          textRef.current.scale.setScalar(baseFontScale * audioScale)
          break
        }
        case 'opacity': {
          const mat = textRef.current.material as THREE.MeshBasicMaterial
          if (mat && 'opacity' in mat) {
            mat.opacity = modOpacity * (0.3 + audioRefs.amplitude * 0.7)
          }
          break
        }
        case 'position': {
          textRef.current.position.x = modPosX + Math.sin(audioRefs.amplitude * Math.PI) * 0.2
          textRef.current.position.y = modPosY + beatAccum.current * 0.1
          break
        }
        case 'rotation': {
          textRef.current.rotation.z = modRot + audioRefs.amplitude * 0.5
          break
        }
      }
    }

    // Always apply intensity and ensure correct blend mode
    const mat = textRef.current.material as THREE.MeshBasicMaterial

    if (mat) {
      if (config.audioProperty !== 'opacity') {
        mat.opacity = modOpacity * intensity
      }
      const targetBlending = getThreeBlending(config.blendMode)
      if (mat.blending !== targetBlending) {
        mat.blending = targetBlending
        mat.transparent = config.blendMode !== 'normal'
        mat.needsUpdate = true
      }
    }
  })

  return (
    <Text
      ref={textRef}
      position={[config.position[0], config.position[1], 0]}
      rotation={[0, 0, config.rotation]}
      fontSize={config.fontSize}
      color={config.color}
      anchorX="center"
      anchorY="middle"
      font={config.fontFamily || undefined}
      material-transparent
      material-opacity={config.opacity}
      material-depthTest={false}
    >
      {config.text}
    </Text>
  )
}
