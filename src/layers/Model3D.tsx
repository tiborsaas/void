import { useRef, useState, useEffect, Suspense, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useGlobalStore, audioRefs } from '../engine/store'
import { getModulatedValue } from '../engine/ModulationEngine'
import { applyBlendToMaterial } from '../utils/blendUtils'
import type { Model3DLayer } from '../types/layers'
import { modelStorage } from '../engine/ModelStorage'

interface Props {
  config: Model3DLayer
}

/**
 * Model3DInner — renders a loaded GLB model with audio reactivity.
 */
function Model3DInner({ config, url }: Props & { url: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const beatAccum = useRef(0)
  const gltf = useLoader(GLTFLoader, url)

  // Clone scene and materials so multiple players/layers can use the same UI model 
  // without interfering, and to ensure we don't pollute the cached loader scene.
  const clonedScene = useMemo(() => {
    const scene = gltf.scene.clone()
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map((m: THREE.Material) => m.clone())
          // Force transparency so we can fade in/out layers cleanly
          child.material.forEach((m: THREE.Material) => { m.transparent = true })
        } else if (child.material) {
          child.material = (child.material as THREE.Material).clone()
          child.material.transparent = true
        }
      }
    })
    return scene
  }, [gltf.scene])

  // Only apply blend mode structurally when the config changes to avoid `needsUpdate` every frame
  useEffect(() => {
    if (!clonedScene) return
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach(mat => {
          if (mat) applyBlendToMaterial(mat, config.blendMode)
        })
      }
    })
  }, [clonedScene, config.blendMode])

  useFrame((state) => {
    if (!groupRef.current) return

    const speed = useGlobalStore.getState().masterSpeed
    const intensity = useGlobalStore.getState().masterIntensity
    const id = config.id

    if (audioRefs.beat) beatAccum.current = 1.0
    beatAccum.current *= 0.9

    // Modulated rotation speed
    const modRotX = getModulatedValue(id, 'rotationSpeed.0', config.rotationSpeed[0], -3, 3)
    const modRotY = getModulatedValue(id, 'rotationSpeed.1', config.rotationSpeed[1], -3, 3)
    const modRotZ = getModulatedValue(id, 'rotationSpeed.2', config.rotationSpeed[2], -3, 3)

    // Auto-rotation
    if (config.autoRotate) {
      groupRef.current.rotation.x += modRotX * speed * 0.01
      groupRef.current.rotation.y += modRotY * speed * 0.01
      groupRef.current.rotation.z += modRotZ * speed * 0.01
    }

    // Position modulation
    const modPosX = getModulatedValue(id, 'position.0', config.position[0], -10, 10)
    const modPosY = getModulatedValue(id, 'position.1', config.position[1], -10, 10)
    const modPosZ = getModulatedValue(id, 'position.2', config.position[2], -10, 10)
    groupRef.current.position.set(modPosX, modPosY, modPosZ)

    // Audio-reactive scale
    const modScale = getModulatedValue(id, 'scale', config.scale, 0.01, 20)
    if (config.audioReactive) {
      const s = modScale * (1 + beatAccum.current * 0.2 + audioRefs.amplitude * 0.1)
      groupRef.current.scale.setScalar(s)
    } else {
      groupRef.current.scale.setScalar(modScale)
    }

    // Apply opacity/intensity to all meshes each frame
    const modOpacity = getModulatedValue(id, 'opacity', config.opacity, 0, 1)
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach(mat => {
          if (mat && mat.opacity !== undefined) {
            mat.opacity = modOpacity * intensity
          }
        })
      }
    })

    void state
  })

  return (
    <group
      ref={groupRef}
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
    >
      <primitive object={clonedScene} />
    </group>
  )
}

/**
 * Model3D — loads a GLB model from IndexedDB and renders it.
 */
export function Model3D({ config }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    if (!config.modelKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBlobUrl(null)
      setIsError(false)
      return
    }

    let url: string | null = null
    setIsError(false)

    modelStorage.getModel(config.modelKey).then((blob) => {
      if (blob) {
        url = URL.createObjectURL(blob)
        setBlobUrl(url)
      } else {
        setIsError(true)
      }
    }).catch((err) => {
      console.error('Failed to load model from db:', err)
      setIsError(true)
    })

    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [config.modelKey])

  if (isError) {
    return null
  }

  if (!blobUrl) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <Model3DInner config={config} url={blobUrl} />
    </Suspense>
  )
}
