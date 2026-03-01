// ─── Properties Panel — Right Drawer ─────────────────────────────────────────
// Opens when a layer is selected. Shows base props (opacity, blendMode) +
// type-specific controls for every layer type.

import { useState } from 'react'
import { usePresetStore } from '../engine/store'
import { modelStorage } from '../engine/ModelStorage'
import type {
    LayerConfig, LayerBlendMode, MeshGeometryType, PrimitiveShape,
    WireframeShape, FBOSeedPattern, DirectionalLightConfig, PointLightConfig,
    HydraProjection,
} from '../types/layers'
import {
    SliderField, Vec2Field, Vec3Field, ColorField, ToggleField,
    SelectField, NumberField, TextareaField, TextInputField,
    UniformsEditor, SectionTitle,
} from './properties/fields'
import { HydraCodeEditor } from './HydraCodeEditor'

// ─── Geometry / shape arg metadata ───────────────────────────────────────────

const MESH_GEOMETRY_ARGS: Record<MeshGeometryType, { labels: string[]; ranges: [number, number][]; steps: number[] }> = {
    sphere: { labels: ['Radius', 'W Segs', 'H Segs'], ranges: [[0.1, 10], [3, 128], [3, 128]], steps: [0.1, 1, 1] },
    icosahedron: { labels: ['Radius', 'Detail'], ranges: [[0.1, 10], [0, 5]], steps: [0.1, 1] },
    torus: { labels: ['Radius', 'Tube', 'RSegs', 'TSegs'], ranges: [[0.1, 10], [0.05, 5], [3, 128], [3, 128]], steps: [0.1, 0.05, 1, 1] },
    torusKnot: { labels: ['Radius', 'Tube', 'TSegs', 'RSegs'], ranges: [[0.1, 10], [0.05, 5], [32, 512], [3, 32]], steps: [0.1, 0.05, 8, 1] },
    box: { labels: ['Width', 'Height', 'Depth'], ranges: [[0.1, 20], [0.1, 20], [0.1, 20]], steps: [0.1, 0.1, 0.1] },
    plane: { labels: ['Width', 'Height', 'W Segs', 'H Segs'], ranges: [[0.1, 20], [0.1, 20], [1, 256], [1, 256]], steps: [0.1, 0.1, 1, 1] },
    cylinder: { labels: ['Top R', 'Bot R', 'Height', 'RadSegs'], ranges: [[0, 10], [0, 10], [0.1, 20], [3, 128]], steps: [0.1, 0.1, 0.1, 1] },
}

const SHAPE_ARGS: Record<PrimitiveShape, { labels: string[]; ranges: [number, number][]; steps: number[] }> = {
    sphere: { labels: ['Radius', 'W Segs', 'H Segs'], ranges: [[0.1, 10], [3, 128], [3, 128]], steps: [0.1, 1, 1] },
    box: { labels: ['Width', 'Height', 'Depth'], ranges: [[0.1, 20], [0.1, 20], [0.1, 20]], steps: [0.1, 0.1, 0.1] },
    torus: { labels: ['Radius', 'Tube', 'RSegs', 'TSegs'], ranges: [[0.1, 10], [0.05, 5], [3, 128], [3, 128]], steps: [0.1, 0.05, 1, 1] },
    torusKnot: { labels: ['Radius', 'Tube', 'TSegs', 'RSegs'], ranges: [[0.1, 10], [0.05, 5], [32, 512], [3, 32]], steps: [0.1, 0.05, 8, 1] },
    cylinder: { labels: ['Top R', 'Bot R', 'Height', 'RadSegs'], ranges: [[0, 10], [0, 10], [0.1, 20], [3, 128]], steps: [0.1, 0.1, 0.1, 1] },
    cone: { labels: ['Radius', 'Height', 'RadSegs'], ranges: [[0.1, 10], [0.1, 20], [3, 128]], steps: [0.1, 0.1, 1] },
    icosahedron: { labels: ['Radius', 'Detail'], ranges: [[0.1, 10], [0, 5]], steps: [0.1, 1] },
    octahedron: { labels: ['Radius', 'Detail'], ranges: [[0.1, 10], [0, 5]], steps: [0.1, 1] },
    dodecahedron: { labels: ['Radius', 'Detail'], ranges: [[0.1, 10], [0, 5]], steps: [0.1, 1] },
}

// ─── Type-specific panels ─────────────────────────────────────────────────────

function ShaderPlanePanel({ layer, update }: PanelProps<'shader-plane'>) {
    const config = layer as Extract<LayerConfig, { type: 'shader-plane' }>

    const patchUniform = (key: string, value: number) => {
        update({ uniforms: { ...config.uniforms, [key]: { ...config.uniforms[key], value } } })
    }

    return (
        <>
            <SectionTitle>Parameters</SectionTitle>
            <UniformsEditor uniforms={config.uniforms} onChange={patchUniform} />
            {Object.keys(config.uniforms).length === 0 && (
                <div className="prop-hint">No configurable parameters for this shader.</div>
            )}
        </>
    )
}

function DisplacedMeshPanel({ layer, update }: PanelProps<'displaced-mesh'>) {
    const config = layer as Extract<LayerConfig, { type: 'displaced-mesh' }>
    const geoInfo = MESH_GEOMETRY_ARGS[config.geometry]

    const patchUniform = (key: string, value: number) => {
        update({ uniforms: { ...config.uniforms, [key]: { ...config.uniforms[key], value } } })
    }

    return (
        <>
            <SectionTitle>Geometry</SectionTitle>
            <SelectField
                label="Shape"
                value={config.geometry}
                options={(['sphere', 'icosahedron', 'torus', 'torusKnot', 'box', 'plane', 'cylinder'] as MeshGeometryType[])
                    .map((v) => ({ value: v, label: v }))}
                onChange={(v) => update({ geometry: v })}
            />
            {geoInfo.labels.map((lbl, i) => (
                <SliderField
                    key={lbl}
                    label={lbl}
                    value={config.geometryArgs[i] ?? geoInfo.ranges[i][0]}
                    min={geoInfo.ranges[i][0]}
                    max={geoInfo.ranges[i][1]}
                    step={geoInfo.steps[i]}
                    onChange={(v) => {
                        const next = [...config.geometryArgs]
                        next[i] = v
                        update({ geometryArgs: next })
                    }}
                />
            ))}
            <ToggleField label="Wireframe" value={config.wireframe} onChange={(v) => update({ wireframe: v })} />

            <SectionTitle>Transform</SectionTitle>
            <SliderField label="Scale" value={config.scale ?? 1} min={0.01} max={10} step={0.01}
                onChange={(v) => update({ scale: v })} />
            <Vec3Field label="Rotation Speed" value={config.rotationSpeed} min={-5} max={5} step={0.01}
                onChange={(v) => update({ rotationSpeed: v })} />
            <Vec3Field label="Init Rotation" value={config.rotation} min={-Math.PI} max={Math.PI} step={0.01}
                onChange={(v) => update({ rotation: v })} />

            <SectionTitle>Audio</SectionTitle>
            <ToggleField label="Audio Reactive" value={config.audioReactive ?? false} onChange={(v) => update({ audioReactive: v })} />

            {Object.keys(config.uniforms).length > 0 && (
                <>
                    <SectionTitle>Uniforms</SectionTitle>
                    <UniformsEditor uniforms={config.uniforms} onChange={patchUniform} />
                </>
            )}
        </>
    )
}

function InstancedParticlesPanel({ layer, update }: PanelProps<'instanced-particles'>) {
    const config = layer as Extract<LayerConfig, { type: 'instanced-particles' }>

    return (
        <>
            <SectionTitle>Simulation</SectionTitle>
            <NumberField label="Count" value={config.count} min={100} max={200000} step={1000}
                onChange={(v) => update({ count: Math.max(100, Math.floor(v)) })} />
            <SliderField label="Size" value={config.size} min={0.001} max={0.2} step={0.001}
                onChange={(v) => update({ size: v })} />
            <SliderField label="Damping" value={config.damping} min={0} max={0.2} step={0.001}
                onChange={(v) => update({ damping: v })} />
            <SliderField label="Max Speed" value={config.maxSpeed} min={0.05} max={5} step={0.01}
                onChange={(v) => update({ maxSpeed: v })} />
            <ToggleField label="Audio Reactive" value={config.audioReactive} onChange={(v) => update({ audioReactive: v })} />

            <SectionTitle>Appearance</SectionTitle>
            <SelectField label="Geometry" value={config.geometry}
                options={[{ value: 'sphere', label: 'Sphere' }, { value: 'box', label: 'Box' }]}
                onChange={(v) => update({ geometry: v })} />
            <SelectField label="Color Mode" value={config.colorMode}
                options={[
                    { value: 'velocity', label: 'Velocity' }, { value: 'position', label: 'Position' },
                    { value: 'age', label: 'Age' }, { value: 'solid', label: 'Solid' },
                ]}
                onChange={(v) => update({ colorMode: v })} />
            {config.colorMode === 'solid' && (
                <ColorField label="Color" value={config.color} onChange={(v) => update({ color: v })} />
            )}

            <SectionTitle>Attractors</SectionTitle>
            {config.attractors.map((att, i) => (
                <div key={i} className="attractor-block">
                    <div className="attractor-block__header">
                        <span className="attractor-block__title">Attractor {i + 1}</span>
                        <button className="attractor-block__remove"
                            onClick={() => update({ attractors: config.attractors.filter((_, j) => j !== i) })}>
                            ✕
                        </button>
                    </div>
                    <Vec3Field label="Position" value={att.position} min={-5} max={5} step={0.1}
                        onChange={(v) => {
                            const next = [...config.attractors]
                            next[i] = { ...att, position: v }
                            update({ attractors: next })
                        }} />
                    <SliderField label="Strength" value={att.strength} min={0} max={3} step={0.01}
                        onChange={(v) => {
                            const next = [...config.attractors]
                            next[i] = { ...att, strength: v }
                            update({ attractors: next })
                        }} />
                    <SliderField label="Radius" value={att.radius} min={0.1} max={10} step={0.1}
                        onChange={(v) => {
                            const next = [...config.attractors]
                            next[i] = { ...att, radius: v }
                            update({ attractors: next })
                        }} />
                </div>
            ))}
            <button className="add-layer-btn" style={{ marginTop: 4 }}
                onClick={() => update({ attractors: [...config.attractors, { position: [0, 0, 0], strength: 0.3, radius: 2 }] })}>
                + Add Attractor
            </button>
        </>
    )
}

function WireframeGeometryPanel({ layer, update }: PanelProps<'wireframe-geometry'>) {
    const config = layer as Extract<LayerConfig, { type: 'wireframe-geometry' }>

    return (
        <>
            <SectionTitle>Global</SectionTitle>
            <SliderField label="Beat Scale" value={config.beatScale} min={0} max={2} step={0.01}
                onChange={(v) => update({ beatScale: v })} />
            <ToggleField label="Audio Reactive" value={config.audioReactive} onChange={(v) => update({ audioReactive: v })} />

            <SectionTitle>Shapes</SectionTitle>
            {config.shapes.map((s, i) => (
                <div key={i} className="attractor-block">
                    <div className="attractor-block__header">
                        <span className="attractor-block__title">Shape {i + 1}</span>
                        <button className="attractor-block__remove"
                            onClick={() => update({ shapes: config.shapes.filter((_, j) => j !== i) })}>✕</button>
                    </div>
                    <SelectField label="Type" value={s.shape}
                        options={(['icosahedron', 'octahedron', 'dodecahedron', 'tetrahedron', 'cube'] as WireframeShape[])
                            .map((v) => ({ value: v, label: v }))}
                        onChange={(v) => {
                            const next = [...config.shapes]; next[i] = { ...s, shape: v }; update({ shapes: next })
                        }} />
                    <SliderField label="Radius" value={s.radius} min={0.1} max={10} step={0.1}
                        onChange={(v) => { const next = [...config.shapes]; next[i] = { ...s, radius: v }; update({ shapes: next }) }} />
                    <SliderField label="Detail" value={s.detail} min={0} max={4} step={1}
                        onChange={(v) => { const next = [...config.shapes]; next[i] = { ...s, detail: v }; update({ shapes: next }) }} />
                    <ColorField label="Color" value={s.color}
                        onChange={(v) => { const next = [...config.shapes]; next[i] = { ...s, color: v }; update({ shapes: next }) }} />
                    <Vec3Field label="Rotation Speed" value={s.rotationSpeed} min={-3} max={3} step={0.01}
                        onChange={(v) => { const next = [...config.shapes]; next[i] = { ...s, rotationSpeed: v }; update({ shapes: next }) }} />
                </div>
            ))}
            <button className="add-layer-btn" style={{ marginTop: 4 }}
                onClick={() => update({ shapes: [...config.shapes, { shape: 'icosahedron', radius: 2, detail: 0, color: '#7b5cff', rotationSpeed: [0, 0.3, 0] }] })}>
                + Add Shape
            </button>
        </>
    )
}

function FBOSimulationPanel({ layer, update }: PanelProps<'fbo-simulation'>) {
    const config = layer as Extract<LayerConfig, { type: 'fbo-simulation' }>

    const patchComputeUniform = (key: string, value: number) =>
        update({ computeUniforms: { ...config.computeUniforms, [key]: { ...config.computeUniforms[key], value } } })

    const patchDisplayUniform = (key: string, value: number) =>
        update({ displayUniforms: { ...config.displayUniforms, [key]: { ...config.displayUniforms[key], value } } })

    return (
        <>
            <SectionTitle>Simulation</SectionTitle>
            <SelectField label="Resolution"
                value={String(config.size) as '128' | '256' | '512' | '1024'}
                options={[{ value: '128', label: '128²' }, { value: '256', label: '256²' }, { value: '512', label: '512²' }, { value: '1024', label: '1024²' }]}
                onChange={(v) => update({ size: parseInt(v) })} />
            <SliderField label="Steps/Frame" value={config.stepsPerFrame} min={1} max={16} step={1}
                onChange={(v) => update({ stepsPerFrame: v })} />
            <ToggleField label="Audio Inject" value={config.audioInject} onChange={(v) => update({ audioInject: v })} />
            <SelectField label="Seed Pattern"
                value={config.seedPattern}
                options={([
                    { value: 'random-spots', label: 'Random Spots' },
                    { value: 'center-seed', label: 'Center Seed' },
                    { value: 'gradient', label: 'Gradient' },
                    { value: 'noise', label: 'Noise' },
                ] as { value: FBOSeedPattern; label: string }[])}
                onChange={(v) => update({ seedPattern: v })} />

            {Object.keys(config.computeUniforms).length > 0 && (
                <>
                    <SectionTitle>Compute Uniforms</SectionTitle>
                    <UniformsEditor uniforms={config.computeUniforms} onChange={patchComputeUniform} />
                </>
            )}
            {Object.keys(config.displayUniforms).length > 0 && (
                <>
                    <SectionTitle>Display Uniforms</SectionTitle>
                    <UniformsEditor uniforms={config.displayUniforms} onChange={patchDisplayUniform} />
                </>
            )}
        </>
    )
}

function Text2DPanel({ layer, update }: PanelProps<'text-2d'>) {
    const config = layer as Extract<LayerConfig, { type: 'text-2d' }>
    return (
        <>
            <SectionTitle>Content</SectionTitle>
            <TextareaField label="Text" value={config.text} onChange={(v) => update({ text: v })} />
            <TextInputField label="Font URL" value={config.fontFamily} placeholder="/fonts/my-font.woff (leave blank for default)"
                onChange={(v) => update({ fontFamily: v })} />
            <SliderField label="Font Size" value={config.fontSize} min={0.1} max={5} step={0.05}
                onChange={(v) => update({ fontSize: v })} />
            <ColorField label="Color" value={config.color} onChange={(v) => update({ color: v })} />

            <SectionTitle>Transform</SectionTitle>
            <Vec2Field label="Position" value={config.position} min={-10} max={10} step={0.05}
                onChange={(v) => update({ position: v })} />
            <SliderField label="Rotation" value={config.rotation} min={-Math.PI} max={Math.PI} step={0.01}
                onChange={(v) => update({ rotation: v })} />

            <SectionTitle>Audio</SectionTitle>
            <ToggleField label="Audio Reactive" value={config.audioReactive} onChange={(v) => update({ audioReactive: v })} />
            {config.audioReactive && (
                <SelectField label="Property" value={config.audioProperty}
                    options={[
                        { value: 'scale', label: 'Scale' }, { value: 'opacity', label: 'Opacity' },
                        { value: 'position', label: 'Position' }, { value: 'rotation', label: 'Rotation' },
                    ]}
                    onChange={(v) => update({ audioProperty: v })} />
            )}
        </>
    )
}

function Text3DPanel({ layer, update }: PanelProps<'text-3d'>) {
    const config = layer as Extract<LayerConfig, { type: 'text-3d' }>
    return (
        <>
            <SectionTitle>Content</SectionTitle>
            <TextareaField label="Text" value={config.text} onChange={(v) => update({ text: v })} />
            <SliderField label="Font Size" value={config.fontSize} min={0.1} max={5} step={0.05}
                onChange={(v) => update({ fontSize: v })} />
            <SliderField label="Depth" value={config.depth} min={0.01} max={2} step={0.01}
                onChange={(v) => update({ depth: v })} />

            <SectionTitle>Material</SectionTitle>
            <SelectField label="Type" value={config.materialType || 'standard'}
                options={[{ value: 'standard', label: 'Standard' }, { value: 'physical', label: 'Physical' }, { value: 'emissive', label: 'Emissive' }, { value: 'wireframe', label: 'Wireframe' }]}
                onChange={(v) => update({ materialType: v })} />
            <ColorField label="Color" value={config.color} onChange={(v) => update({ color: v })} />
            {(config.materialType === 'emissive') && (
                <>
                    <ColorField label="Emissive" value={config.emissive} onChange={(v) => update({ emissive: v })} />
                    <SliderField label="Emissive Intensity" value={config.emissiveIntensity} min={0} max={5} step={0.05}
                        onChange={(v) => update({ emissiveIntensity: v })} />
                </>
            )}
            {(config.materialType === 'standard' || config.materialType === 'physical') && (
                <>
                    <SliderField label="Metalness" value={config.metalness ?? 0} min={0} max={1} step={0.01}
                        onChange={(v) => update({ metalness: v })} />
                    <SliderField label="Roughness" value={config.roughness ?? 1} min={0} max={1} step={0.01}
                        onChange={(v) => update({ roughness: v })} />
                </>
            )}
            {config.materialType !== 'wireframe' && (
                <ToggleField label="Wireframe Override" value={config.wireframe ?? false}
                    onChange={(v) => update({ wireframe: v })} />
            )}

            <SectionTitle>Transform</SectionTitle>
            <Vec3Field label="Position" value={config.position} min={-10} max={10} step={0.05}
                onChange={(v) => update({ position: v })} />
            <Vec3Field label="Rotation Speed" value={config.rotationSpeed} min={-3} max={3} step={0.01}
                onChange={(v) => update({ rotationSpeed: v })} />
            <ToggleField label="Audio Reactive" value={config.audioReactive} onChange={(v) => update({ audioReactive: v })} />
        </>
    )
}

function Model3DPanel({ layer, update }: PanelProps<'model-3d'>) {
    const config = layer as Extract<LayerConfig, { type: 'model-3d' }>

    const handleFilePick = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.glb,.gltf'
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return
            const key = `model-${Date.now()}`
            await modelStorage.saveModel(key, file)
            update({ modelKey: key, filename: file.name })
        }
        input.click()
    }

    return (
        <>
            <SectionTitle>Model</SectionTitle>
            <div className="param-row">
                <span className="param-label">File</span>
                <span className="param-value" style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75em' }}>
                    {config.filename || '(none)'}
                </span>
            </div>
            <button className="add-layer-btn" style={{ marginTop: 4 }} onClick={handleFilePick}>
                {config.filename ? 'Replace GLB…' : 'Load GLB…'}
            </button>

            <SectionTitle>Transform</SectionTitle>
            <SliderField label="Scale" value={config.scale} min={0.01} max={20} step={0.01}
                onChange={(v) => update({ scale: v })} />
            <Vec3Field label="Position" value={config.position} min={-10} max={10} step={0.05}
                onChange={(v) => update({ position: v })} />
            <Vec3Field label="Rotation Speed" value={config.rotationSpeed} min={-3} max={3} step={0.01}
                onChange={(v) => update({ rotationSpeed: v })} />

            <SectionTitle>Behaviour</SectionTitle>
            <ToggleField label="Auto Rotate" value={config.autoRotate} onChange={(v) => update({ autoRotate: v })} />
            <ToggleField label="Audio Reactive" value={config.audioReactive} onChange={(v) => update({ audioReactive: v })} />
        </>
    )
}

function Primitive3DPanel({ layer, update }: PanelProps<'primitive-3d'>) {
    const config = layer as Extract<LayerConfig, { type: 'primitive-3d' }>
    const shapeInfo = SHAPE_ARGS[config.shape]

    return (
        <>
            <SectionTitle>Geometry</SectionTitle>
            <SelectField label="Shape" value={config.shape}
                options={(['sphere', 'box', 'torus', 'torusKnot', 'cylinder', 'cone', 'icosahedron', 'octahedron', 'dodecahedron'] as PrimitiveShape[])
                    .map((v) => ({ value: v, label: v }))}
                onChange={(v) => update({ shape: v })} />
            {shapeInfo.labels.map((lbl, i) => (
                <SliderField key={lbl} label={lbl}
                    value={config.shapeArgs[i] ?? shapeInfo.ranges[i][0]}
                    min={shapeInfo.ranges[i][0]} max={shapeInfo.ranges[i][1]} step={shapeInfo.steps[i]}
                    onChange={(v) => {
                        const next = [...config.shapeArgs]; next[i] = v; update({ shapeArgs: next })
                    }} />
            ))}

            <SectionTitle>Material</SectionTitle>
            <SelectField label="Type" value={config.materialType}
                options={[{ value: 'standard', label: 'Standard' }, { value: 'physical', label: 'Physical' }, { value: 'emissive', label: 'Emissive' }, { value: 'wireframe', label: 'Wireframe' }]}
                onChange={(v) => update({ materialType: v })} />
            <ColorField label="Color" value={config.color} onChange={(v) => update({ color: v })} />
            {(config.materialType === 'emissive') && (
                <>
                    <ColorField label="Emissive" value={config.emissive} onChange={(v) => update({ emissive: v })} />
                    <SliderField label="Emissive Intensity" value={config.emissiveIntensity} min={0} max={5} step={0.05}
                        onChange={(v) => update({ emissiveIntensity: v })} />
                </>
            )}
            {(config.materialType === 'standard' || config.materialType === 'physical') && (
                <>
                    <SliderField label="Metalness" value={config.metalness} min={0} max={1} step={0.01}
                        onChange={(v) => update({ metalness: v })} />
                    <SliderField label="Roughness" value={config.roughness} min={0} max={1} step={0.01}
                        onChange={(v) => update({ roughness: v })} />
                </>
            )}
            {config.materialType !== 'wireframe' && (
                <ToggleField label="Wireframe" value={config.wireframe} onChange={(v) => update({ wireframe: v })} />
            )}

            <SectionTitle>Transform</SectionTitle>
            <SliderField label="Scale" value={config.scale} min={0.01} max={10} step={0.01}
                onChange={(v) => update({ scale: v })} />
            <Vec3Field label="Position" value={config.position} min={-10} max={10} step={0.05}
                onChange={(v) => update({ position: v })} />
            <Vec3Field label="Rotation Speed" value={config.rotationSpeed} min={-3} max={3} step={0.01}
                onChange={(v) => update({ rotationSpeed: v })} />
            <ToggleField label="Audio Reactive" value={config.audioReactive} onChange={(v) => update({ audioReactive: v })} />
        </>
    )
}

function PostProcessingPanel({ layer, update }: PanelProps<'post-processing'>) {
    const config = layer as Extract<LayerConfig, { type: 'post-processing' }>
    return (
        <>
            <SectionTitle>Bloom</SectionTitle>
            <ToggleField label="Enabled" value={config.bloomEnabled} onChange={(v) => update({ bloomEnabled: v })} />
            {config.bloomEnabled && (
                <>
                    <SliderField label="Intensity" value={config.bloomIntensity} min={0} max={5} step={0.05}
                        onChange={(v) => update({ bloomIntensity: v })} />
                    <SliderField label="Threshold" value={config.bloomThreshold} min={0} max={1} step={0.01}
                        onChange={(v) => update({ bloomThreshold: v })} />
                    <SliderField label="Radius" value={config.bloomRadius} min={0} max={1} step={0.01}
                        onChange={(v) => update({ bloomRadius: v })} />
                </>
            )}

            <SectionTitle>Chromatic Aberration</SectionTitle>
            <ToggleField label="Enabled" value={config.chromaticEnabled} onChange={(v) => update({ chromaticEnabled: v })} />
            {config.chromaticEnabled && (
                <SliderField label="Offset" value={config.chromaticOffset} min={0} max={0.05} step={0.001}
                    onChange={(v) => update({ chromaticOffset: v })} />
            )}

            <SectionTitle>Vignette</SectionTitle>
            <ToggleField label="Enabled" value={config.vignetteEnabled} onChange={(v) => update({ vignetteEnabled: v })} />
            {config.vignetteEnabled && (
                <>
                    <SliderField label="Darkness" value={config.vignetteDarkness} min={0} max={1} step={0.01}
                        onChange={(v) => update({ vignetteDarkness: v })} />
                    <SliderField label="Offset" value={config.vignetteOffset} min={0} max={1} step={0.01}
                        onChange={(v) => update({ vignetteOffset: v })} />
                </>
            )}

            <SectionTitle>Noise</SectionTitle>
            <ToggleField label="Enabled" value={config.noiseEnabled} onChange={(v) => update({ noiseEnabled: v })} />
            {config.noiseEnabled && (
                <SliderField label="Opacity" value={config.noiseOpacity} min={0} max={0.5} step={0.01}
                    onChange={(v) => update({ noiseOpacity: v })} />
            )}

            <SectionTitle>Audio</SectionTitle>
            <ToggleField label="Audio Reactive" value={config.audioReactive} onChange={(v) => update({ audioReactive: v })} />
        </>
    )
}

function MirrorFXPanel({ layer, update }: PanelProps<'mirror-fx'>) {
    const config = layer as Extract<LayerConfig, { type: 'mirror-fx' }>
    return (
        <>
            <SectionTitle>Mirror Type</SectionTitle>
            <SelectField
                label="Mode"
                value={String(config.mode) as '0' | '1' | '2' | '3' | '4'}
                options={[
                    { value: '0', label: 'None' },
                    { value: '1', label: 'Horizontal (Left ↔ Right)' },
                    { value: '2', label: 'Vertical (Top ↕ Bottom)' },
                    { value: '3', label: 'Quad (4-way)' },
                    { value: '4', label: 'Kaleidoscope' },
                ]}
                onChange={(v) => update({ mode: parseInt(v, 10) })}
            />

            {config.mode === 4 && (
                <>
                    <SectionTitle>Kaleidoscope</SectionTitle>
                    <SliderField label="Sides" value={config.sides} min={2} max={24} step={1}
                        onChange={(v) => update({ sides: v })} />
                    <SliderField label="Angle Offset" value={config.angle} min={0} max={Math.PI * 2} step={0.01}
                        onChange={(v) => update({ angle: v })} />
                </>
            )}

            <SectionTitle>Audio</SectionTitle>
            <ToggleField label="Audio Reactive" value={config.audioReactive} onChange={(v) => update({ audioReactive: v })} />
        </>
    )
}

function LightsPanel({ layer, update }: PanelProps<'lights'>) {
    const config = layer as Extract<LayerConfig, { type: 'lights' }>

    const updateDir = (i: number, patch: Partial<DirectionalLightConfig>) => {
        const next = config.dirLights.map((d, j) => j === i ? { ...d, ...patch } : d)
        update({ dirLights: next })
    }
    const updatePoint = (i: number, patch: Partial<PointLightConfig>) => {
        const next = config.pointLights.map((p, j) => j === i ? { ...p, ...patch } : p)
        update({ pointLights: next })
    }

    return (
        <>
            <SectionTitle>Ambient</SectionTitle>
            <ToggleField label="Enabled" value={config.ambientEnabled} onChange={(v) => update({ ambientEnabled: v })} />
            {config.ambientEnabled && (
                <>
                    <ColorField label="Color" value={config.ambientColor} onChange={(v) => update({ ambientColor: v })} />
                    <SliderField label="Intensity" value={config.ambientIntensity} min={0} max={5} step={0.05}
                        onChange={(v) => update({ ambientIntensity: v })} />
                </>
            )}

            <SectionTitle>Directional Lights</SectionTitle>
            {config.dirLights.map((dl, i) => (
                <div key={i} className="attractor-block">
                    <div className="attractor-block__header">
                        <span className="attractor-block__title">Dir {i + 1}</span>
                        <button className="attractor-block__remove"
                            onClick={() => update({ dirLights: config.dirLights.filter((_, j) => j !== i) })}>✕</button>
                    </div>
                    <ToggleField label="Enabled" value={dl.enabled} onChange={(v) => updateDir(i, { enabled: v })} />
                    <ColorField label="Color" value={dl.color} onChange={(v) => updateDir(i, { color: v })} />
                    <SliderField label="Intensity" value={dl.intensity} min={0} max={5} step={0.05}
                        onChange={(v) => updateDir(i, { intensity: v })} />
                    <Vec3Field label="Position" value={dl.position} min={-20} max={20} step={0.5}
                        onChange={(v) => updateDir(i, { position: v })} />
                </div>
            ))}
            <button className="add-layer-btn" style={{ marginTop: 4 }}
                onClick={() => update({ dirLights: [...config.dirLights, { enabled: true, color: '#ffffff', intensity: 1, position: [5, 10, 5] }] })}>
                + Add Dir Light
            </button>

            <SectionTitle>Point Lights</SectionTitle>
            {config.pointLights.map((pl, i) => (
                <div key={i} className="attractor-block">
                    <div className="attractor-block__header">
                        <span className="attractor-block__title">Point {i + 1}</span>
                        <button className="attractor-block__remove"
                            onClick={() => update({ pointLights: config.pointLights.filter((_, j) => j !== i) })}>✕</button>
                    </div>
                    <ToggleField label="Enabled" value={pl.enabled} onChange={(v) => updatePoint(i, { enabled: v })} />
                    <ColorField label="Color" value={pl.color} onChange={(v) => updatePoint(i, { color: v })} />
                    <SliderField label="Intensity" value={pl.intensity} min={0} max={10} step={0.1}
                        onChange={(v) => updatePoint(i, { intensity: v })} />
                    <Vec3Field label="Position" value={pl.position} min={-20} max={20} step={0.5}
                        onChange={(v) => updatePoint(i, { position: v })} />
                    <SliderField label="Distance" value={pl.distance} min={0} max={50} step={0.5}
                        onChange={(v) => updatePoint(i, { distance: v })} />
                    <SliderField label="Decay" value={pl.decay} min={0} max={4} step={0.1}
                        onChange={(v) => updatePoint(i, { decay: v })} />
                </div>
            ))}
            <button className="add-layer-btn" style={{ marginTop: 4 }}
                onClick={() => update({ pointLights: [...config.pointLights, { enabled: true, color: '#ff8844', intensity: 2, position: [0, 3, 0], distance: 20, decay: 2 }] })}>
                + Add Point Light
            </button>

            <SectionTitle>Audio</SectionTitle>
            <ToggleField label="Audio Reactive" value={config.audioReactive} onChange={(v) => update({ audioReactive: v })} />
            {config.audioReactive && (
                <SliderField label="Beat Intensity" value={config.beatIntensity} min={0} max={3} step={0.05}
                    onChange={(v) => update({ beatIntensity: v })} />
            )}
        </>
    )
}

// ─── Panel dispatch helper ────────────────────────────────────────────────────

function HydraPanel({ layer, update }: PanelProps<'hydra'>) {
    const config = layer as Extract<LayerConfig, { type: 'hydra' }>
    const [editorOpen, setEditorOpen] = useState(false)

    return (
        <>
            <SectionTitle>Sketch</SectionTitle>
            <div style={{ marginBottom: 8 }}>
                <button
                    className="hydra-edit-code-btn"
                    onClick={() => setEditorOpen(true)}
                >
                    〰 Edit Hydra Code
                </button>
            </div>
            <div className="hydra-code-preview">
                {config.code.split('\n').slice(0, 3).join('\n')}
                {config.code.split('\n').length > 3 ? '\n…' : ''}
            </div>

            <SectionTitle>Projection</SectionTitle>
            <SelectField
                label="Shape"
                value={config.projection}
                options={(['plane', 'sphere', 'box', 'torus', 'torusKnot', 'cylinder'] as HydraProjection[])
                    .map((v) => ({ value: v, label: v }))}
                onChange={(v) => update({ projection: v })}
            />

            {config.projection !== 'plane' && (
                <SliderField
                    label="Scale"
                    value={config.scale}
                    min={0.1} max={10} step={0.1}
                    onChange={(v) => update({ scale: v })}
                />
            )}

            <Vec2Field
                label="Resolution"
                value={config.resolution}
                min={128} max={2048} step={128}
                onChange={(v) => update({ resolution: v as [number, number] })}
            />

            <SectionTitle>Transform</SectionTitle>
            {config.projection !== 'plane' && (
                <Vec3Field
                    label="Position"
                    value={config.position}
                    min={-20} max={20} step={0.1}
                    onChange={(v) => update({ position: v as [number, number, number] })}
                />
            )}
            <Vec3Field
                label="Rotation"
                value={config.rotation}
                min={-Math.PI} max={Math.PI} step={0.01}
                onChange={(v) => update({ rotation: v as [number, number, number] })}
            />
            <Vec3Field
                label="Rotation Speed"
                value={config.rotationSpeed}
                min={-2} max={2} step={0.01}
                onChange={(v) => update({ rotationSpeed: v as [number, number, number] })}
            />

            <SectionTitle>Audio</SectionTitle>
            <ToggleField
                label="Audio Reactive"
                value={config.audioReactive}
                onChange={(v) => update({ audioReactive: v })}
            />

            {editorOpen && (
                <HydraCodeEditor
                    layerId={config.id}
                    initialCode={config.code}
                    onRun={(code) => update({ code })}
                    onClose={() => setEditorOpen(false)}
                />
            )}
        </>
    )
}
type PanelProps<T extends LayerConfig['type']> = {
    layer: LayerConfig
    update: (patch: Partial<LayerConfig>) => void
}

function TypePanel({ layer, update }: { layer: LayerConfig; update: (p: Partial<LayerConfig>) => void }) {
    switch (layer.type) {
        case 'shader-plane': return <ShaderPlanePanel layer={layer} update={update} />
        case 'displaced-mesh': return <DisplacedMeshPanel layer={layer} update={update} />
        case 'instanced-particles': return <InstancedParticlesPanel layer={layer} update={update} />
        case 'wireframe-geometry': return <WireframeGeometryPanel layer={layer} update={update} />
        case 'fbo-simulation': return <FBOSimulationPanel layer={layer} update={update} />
        case 'text-2d': return <Text2DPanel layer={layer} update={update} />
        case 'text-3d': return <Text3DPanel layer={layer} update={update} />
        case 'model-3d': return <Model3DPanel layer={layer} update={update} />
        case 'primitive-3d': return <Primitive3DPanel layer={layer} update={update} />
        case 'post-processing': return <PostProcessingPanel layer={layer} update={update} />
        case 'mirror-fx': return <MirrorFXPanel layer={layer} update={update} />
        case 'lights': return <LightsPanel layer={layer} update={update} />
        case 'hydra': return <HydraPanel layer={layer} update={update} />
    }
}

// ─── Main Component ───────────────────────────────────────────────────────────

const BLEND_OPTIONS: { value: LayerBlendMode; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'additive', label: 'Additive' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen', label: 'Screen' },
]

export function PropertiesPanel() {
    const activePreset = usePresetStore((s) => s.presets[s.activePresetId])
    const selectedLayerId = usePresetStore((s) => s.editor.selectedLayerId)
    const selectLayer = usePresetStore((s) => s.selectLayer)
    const updateLayer = usePresetStore((s) => s.updateLayer)

    if (!activePreset || !selectedLayerId) {
        return (
            <div className="properties-panel properties-panel--empty">
                <div className="properties-panel__placeholder">
                    Select a layer to edit properties
                </div>
            </div>
        )
    }

    const layer = activePreset.layers.find((l) => l.id === selectedLayerId)
    if (!layer) return null

    const update = (patch: Partial<LayerConfig>) => updateLayer(selectedLayerId, patch)

    return (
        <div className="properties-panel">
            {/* Header */}
            <div className="properties-panel__header">
                <div className="properties-panel__title-group">
                    <span className="properties-panel__type-badge">{layer.type}</span>
                    <input
                        className="properties-panel__name-input"
                        value={layer.name}
                        onChange={(e) => update({ name: e.target.value })}
                    />
                </div>
                <button
                    className="properties-panel__close"
                    onClick={() => selectLayer(null)}
                    title="Close properties"
                >
                    ✕
                </button>
            </div>

            {/* Scrollable body */}
            <div className="properties-panel__body">
                {/* Base: opacity + blend */}
                <div className="prop-base-section">
                    <SliderField
                        label="Opacity"
                        value={layer.opacity}
                        min={0} max={1} step={0.01}
                        onChange={(v) => update({ opacity: v })}
                    />
                    <SelectField
                        label="Blend Mode"
                        value={layer.blendMode}
                        options={BLEND_OPTIONS}
                        onChange={(v) => update({ blendMode: v })}
                    />
                </div>

                {/* Divider */}
                <div className="prop-divider" />

                {/* Type-specific controls */}
                <TypePanel layer={layer} update={update} />
            </div>
        </div>
    )
}
