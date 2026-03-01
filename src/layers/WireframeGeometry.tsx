import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGlobalStore, audioRefs } from '../engine/store'
import { getBlendJSXProps } from '../utils/blendUtils'
import type { WireframeGeometryLayer, WireframeShape } from '../types/layers'

interface Props {
  config: WireframeGeometryLayer
}

function createWireframeGeometry(shape: WireframeShape, radius: number, detail: number): THREE.BufferGeometry {
  let baseGeom: THREE.BufferGeometry
  switch (shape) {
    case 'icosahedron': baseGeom = new THREE.IcosahedronGeometry(radius, detail); break
    case 'octahedron': baseGeom = new THREE.OctahedronGeometry(radius, detail); break
    case 'dodecahedron': baseGeom = new THREE.DodecahedronGeometry(radius, detail); break
    case 'tetrahedron': baseGeom = new THREE.TetrahedronGeometry(radius, detail); break
    case 'cube': baseGeom = new THREE.BoxGeometry(radius * 2, radius * 2, radius * 2); break
    default: baseGeom = new THREE.IcosahedronGeometry(radius, detail)
  }
  return new THREE.EdgesGeometry(baseGeom)
}

/**
 * WireframeGeometry — nested wireframe polyhedra with beat-reactive scaling.
 * Inspired by SacredGeometry scene.
 */
export function WireframeGeometry({ config }: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const beatAccum = useRef(0)

  const shapeRefs = useRef<THREE.LineSegments[]>([])

  const geoKey = config.shapes.map((s) => `${s.shape}-${s.radius}-${s.detail}`).join('|')
  const geometries = useMemo(
    () => config.shapes.map((s) => createWireframeGeometry(s.shape, s.radius, s.detail)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geoKey],
  )

  // Dispose geometries when they're replaced or the layer is unmounted
  useEffect(() => {
    return () => { geometries.forEach((g) => g.dispose()) }
  }, [geometries])

  useFrame((state) => {
    const speed = useGlobalStore.getState().masterSpeed
    const hue = useGlobalStore.getState().masterHue
    const intensity = useGlobalStore.getState().masterIntensity
    const t = state.clock.elapsedTime * speed

    if (audioRefs.beat) beatAccum.current = 1.0
    beatAccum.current *= 0.9

    const beatScale = 1 + beatAccum.current * config.beatScale

    shapeRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const shapeDef = config.shapes[i]
      if (!shapeDef) return

      mesh.rotation.x += shapeDef.rotationSpeed[0] * speed * 0.01
      mesh.rotation.y += shapeDef.rotationSpeed[1] * speed * 0.01
      mesh.rotation.z += shapeDef.rotationSpeed[2] * speed * 0.01

      if (config.audioReactive) {
        mesh.scale.setScalar(beatScale)
      }

      // Update color with hue shift
      const mat = mesh.material as THREE.LineBasicMaterial
      const baseColor = new THREE.Color(shapeDef.color)
      baseColor.offsetHSL(hue, 0, 0)
      mat.color.copy(baseColor)
      mat.opacity = intensity * config.opacity
    })

    void t // used in rotation via speed
  })

  return (
    <group ref={groupRef}>
      {config.shapes.map((shapeDef, i) => (
        <lineSegments
          key={`${config.id}-shape-${i}`}
          ref={(el: THREE.LineSegments) => { shapeRefs.current[i] = el }}
          geometry={geometries[i]}
        >
          <lineBasicMaterial
            color={shapeDef.color}
            transparent
            opacity={config.opacity}
            depthWrite={false}
            key={config.blendMode}
            {...(getBlendJSXProps(config.blendMode) as object)}
          />
        </lineSegments>
      ))}
    </group>
  )
}
