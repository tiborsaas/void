// ─── Layer Stack — Left Drawer ────────────────────────────────────────────────
// Displays the active preset's layer list, supports reorder (drop-based drag),
// visibility/name editing, blend mode, and an "Add Layer" type picker.

import { useState, useRef, useCallback } from 'react'
import { usePresetStore } from '../engine/store'
import type { LayerType, LayerConfig, LayerBlendMode, MeshGeometryType, PrimitiveShape, DirectionalLightConfig, PointLightConfig } from '../types/layers'
import { createVoidTunnelLayer, createGlitchMatrixLayer, createTerrainLayer } from '../presets/factory'
import LIQUID_VERTEX from '../shaders/scenes/liquid-vertex.glsl'
import LIQUID_FRAGMENT from '../shaders/scenes/liquid-fragment.glsl'

// ─── Layer type metadata ──────────────────────────────────────────────────────

export const LAYER_TYPE_ICONS: Record<LayerType, string> = {
    'shader-plane': '▦',
    'displaced-mesh': '◉',
    'instanced-particles': '⁘',
    'wireframe-geometry': '△',
    'fbo-simulation': '◎',
    'text-2d': 'T',
    'text-3d': 'T³',
    'model-3d': '▣',
    'primitive-3d': '◇',
    'post-processing': '✦',
    'mirror-fx': '◨',
    'lights': '☀',
    'hydra': '〰',
}

export const LAYER_TYPE_LABELS: Record<LayerType, string> = {
    'shader-plane': 'Shader',
    'displaced-mesh': 'Displaced Mesh',
    'instanced-particles': 'Particles',
    'wireframe-geometry': 'Wireframe',
    'fbo-simulation': 'FBO Sim',
    'text-2d': 'Text 2D',
    'text-3d': 'Text 3D',
    'model-3d': 'Model 3D',
    'primitive-3d': 'Primitive',
    'post-processing': 'Post FX',
    'mirror-fx': 'Mirror FX',
    'lights': 'Lights',
    'hydra': 'Hydra Synth',
}

const BLEND_CYCLE: LayerBlendMode[] = ['normal', 'additive', 'multiply', 'screen']

const BLEND_LABELS: Record<LayerBlendMode, string> = {
    normal: 'NRM',
    additive: 'ADD',
    multiply: 'MUL',
    screen: 'SCR',
}

// ─── Default layer factories ──────────────────────────────────────────────────

export function createDefaultLayer(type: LayerType): LayerConfig {
    const id = `${type}-${Date.now()}`
    const base = { id, type, name: LAYER_TYPE_LABELS[type], visible: true, opacity: 1, blendMode: 'normal' as const }

    switch (type) {
        case 'shader-plane':
            return {
                ...base, type: 'shader-plane',
                vertexShader: `varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
                fragmentShader: `uniform float uTime;\nvarying vec2 vUv;\nvoid main() { gl_FragColor = vec4(vUv, sin(uTime)*0.5+0.5, 1.0); }`,
                uniforms: {},
            }
        case 'displaced-mesh':
            return {
                ...base, type: 'displaced-mesh',
                geometry: 'icosahedron' as MeshGeometryType,
                geometryArgs: [2, 64],
                vertexShader: LIQUID_VERTEX,
                fragmentShader: LIQUID_FRAGMENT,
                uniforms: {
                    uNoiseScale: { value: 1.5, min: 0.5, max: 5, step: 0.1, label: 'Noise Scale' },
                    uDisplacement: { value: 1, min: 0.1, max: 3, step: 0.05, label: 'Displacement' },
                    uFresnelPower: { value: 3, min: 1, max: 8, step: 0.1, label: 'Fresnel Power' },
                },
                wireframe: false,
                rotation: [0, 0, 0] as [number, number, number],
                rotationSpeed: [0.1, 0.15, 0.05] as [number, number, number],
                scale: 1,
                audioReactive: true,
            }
        case 'instanced-particles':
            return {
                ...base, type: 'instanced-particles',
                blendMode: 'additive',
                count: 10000, size: 0.02, geometry: 'sphere',
                colorMode: 'velocity', color: '#ffffff',
                attractors: [
                    { position: [0, 0, 0], strength: 0.5, radius: 2 },
                    { position: [2, 0, 0], strength: 0.3, radius: 1.5 },
                    { position: [-1, 2, 0], strength: 0.3, radius: 1.5 },
                ],
                damping: 0.02, maxSpeed: 0.5, audioReactive: true,
            }
        case 'wireframe-geometry':
            return {
                ...base, type: 'wireframe-geometry',
                shapes: [
                    { shape: 'icosahedron', radius: 2, detail: 0, color: '#7b5cff', rotationSpeed: [0.2, 0.3, 0] },
                    { shape: 'octahedron', radius: 1.5, detail: 0, color: '#ff5cab', rotationSpeed: [-0.1, 0.2, 0.1] },
                ],
                beatScale: 0.3, audioReactive: true,
            }
        case 'fbo-simulation':
            return {
                ...base, type: 'fbo-simulation',
                size: 512, computeShader: '', displayShader: '',
                computeUniforms: {}, displayUniforms: {},
                stepsPerFrame: 4, audioInject: true,
                seedPattern: 'random-spots',
            }
        case 'text-2d':
            return {
                ...base, type: 'text-2d',
                text: 'VOID', fontSize: 0.5, fontFamily: '', color: '#ffffff',
                position: [0, 0], rotation: 0, audioReactive: true, audioProperty: 'scale',
            }
        case 'text-3d':
            return {
                ...base, type: 'text-3d',
                text: 'VOID', fontSize: 1, color: '#ffffff',
                materialType: 'standard', metalness: 0, roughness: 1, wireframe: false,
                emissive: '#7b5cff', emissiveIntensity: 0.5, depth: 0.2,
                position: [0, 0, 0], rotation: [0, 0, 0], rotationSpeed: [0, 0.3, 0],
                audioReactive: true,
            }
        case 'model-3d':
            return {
                ...base, type: 'model-3d',
                modelKey: '', filename: '', scale: 1,
                position: [0, 0, 0], rotation: [0, 0, 0], rotationSpeed: [0, 0.3, 0],
                autoRotate: true, audioReactive: true,
            }
        case 'primitive-3d':
            return {
                ...base, type: 'primitive-3d',
                shape: 'sphere' as PrimitiveShape, shapeArgs: [1, 32, 32],
                materialType: 'emissive', color: '#ffffff', emissive: '#7b5cff',
                emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3, wireframe: false,
                position: [0, 0, 0], rotation: [0, 0, 0], rotationSpeed: [0, 0.3, 0],
                scale: 1, audioReactive: true,
            }
        case 'post-processing':
            return {
                ...base, type: 'post-processing',
                bloomEnabled: true, bloomIntensity: 1.5, bloomThreshold: 0.6, bloomRadius: 0.8,
                chromaticEnabled: true, chromaticOffset: 0.002,
                vignetteEnabled: true, vignetteDarkness: 0.7, vignetteOffset: 0.3,
                noiseEnabled: true, noiseOpacity: 0.08,
                audioReactive: true,
            }
        case 'mirror-fx':
            return {
                ...base, type: 'mirror-fx',
                mode: 1, // 1: Horizontal by default
                sides: 6,
                angle: 0,
                audioReactive: true,
            }
        case 'lights':
            return {
                ...base, type: 'lights',
                ambientEnabled: true,
                ambientColor: '#ffffff',
                ambientIntensity: 0.4,
                dirLights: [
                    { enabled: true, color: '#ffffff', intensity: 1.5, position: [5, 10, 5] } as DirectionalLightConfig,
                    { enabled: true, color: '#8888ff', intensity: 0.5, position: [-5, 2, -3] } as DirectionalLightConfig,
                ] as DirectionalLightConfig[],
                pointLights: [
                    { enabled: false, color: '#ff6644', intensity: 2, position: [0, 3, 0], distance: 20, decay: 2 } as PointLightConfig,
                ] as PointLightConfig[],
                audioReactive: true,
                beatIntensity: 1.0,
            }
        case 'hydra':
            return {
                ...base, type: 'hydra',
                blendMode: 'additive',
                code: `osc(60, 0.1, 1.4)\n  .kaleid(4)\n  .color(0.9, 0.2, 0.8)\n  .out()`,
                projection: 'plane',
                resolution: [1280, 720],
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                rotationSpeed: [0, 0, 0],
                scale: 2,
                audioReactive: false,
            }
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LayerStack() {
    const activePreset = usePresetStore((s) => s.presets[s.activePresetId])
    const selectedLayerId = usePresetStore((s) => s.editor.selectedLayerId)
    const selectLayer = usePresetStore((s) => s.selectLayer)
    const removeLayer = usePresetStore((s) => s.removeLayer)
    const addLayer = usePresetStore((s) => s.addLayer)
    const toggleVisibility = usePresetStore((s) => s.toggleLayerVisibility)
    const reorderLayers = usePresetStore((s) => s.reorderLayers)
    const updateLayer = usePresetStore((s) => s.updateLayer)

    const [showTypePicker, setShowTypePicker] = useState(false)
    const [showShaderSubPicker, setShowShaderSubPicker] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    // Visual drag-over indicator (React state is fine since it's display-only)
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

    // Drag source tracked with a ref — avoids stale-closure reorder bugs
    const dragSrcIdxRef = useRef<number | null>(null)

    const handleAddLayer = useCallback((type: LayerType) => {
        if (type === 'shader-plane') {
            setShowShaderSubPicker(true)
            return
        }
        const layer = createDefaultLayer(type)
        addLayer(layer)
        selectLayer(layer.id)
        setShowTypePicker(false)
    }, [addLayer, selectLayer])

    const handleAddShaderLayer = useCallback((layer: LayerConfig) => {
        addLayer(layer)
        selectLayer(layer.id)
        setShowTypePicker(false)
        setShowShaderSubPicker(false)
    }, [addLayer, selectLayer])

    const cycleBlend = useCallback((e: React.MouseEvent, layer: LayerConfig) => {
        e.stopPropagation()
        const idx = BLEND_CYCLE.indexOf(layer.blendMode)
        const next = BLEND_CYCLE[(idx + 1) % BLEND_CYCLE.length]
        updateLayer(layer.id, { blendMode: next })
    }, [updateLayer])

    const startRename = useCallback((e: React.MouseEvent, layer: LayerConfig) => {
        e.stopPropagation()
        setEditingId(layer.id)
        setEditName(layer.name)
    }, [])

    const commitRename = useCallback(() => {
        if (editingId && editName.trim()) {
            updateLayer(editingId, { name: editName.trim() })
        }
        setEditingId(null)
    }, [editingId, editName, updateLayer])

    // ─── Drag handlers (drop-based reorder) ──────────────────────────────────

    const onDragStart = (e: React.DragEvent, actualIdx: number) => {
        dragSrcIdxRef.current = actualIdx
        e.dataTransfer.effectAllowed = 'move'
    }

    const onDragOver = (e: React.DragEvent, actualIdx: number) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOverIdx(actualIdx)
    }

    const onDrop = (e: React.DragEvent, actualIdx: number) => {
        e.preventDefault()
        if (dragSrcIdxRef.current !== null && dragSrcIdxRef.current !== actualIdx) {
            reorderLayers(dragSrcIdxRef.current, actualIdx)
        }
        dragSrcIdxRef.current = null
        setDragOverIdx(null)
    }

    const onDragEnd = () => {
        dragSrcIdxRef.current = null
        setDragOverIdx(null)
    }

    if (!activePreset) return null

    // Display reversed: top of list = highest array index = front-most layer
    const layers = activePreset.layers
    const reversed = [...layers].map((l, i) => ({ layer: l, actualIdx: i })).reverse()

    return (
        <div className="layer-stack-panel">
            {/* Header */}
            <div className="layer-stack__header">
                <span className="layer-stack__title">✎ {activePreset.name}</span>
            </div>

            {/* Layer list */}
            <div className="layer-stack__list">
                {reversed.map(({ layer, actualIdx }) => {
                    const isSelected = layer.id === selectedLayerId
                    const isDragOver = dragOverIdx === actualIdx

                    return (
                        <div
                            key={layer.id}
                            data-actual-idx={actualIdx}
                            className={[
                                'layer-item',
                                isSelected ? 'layer-item--selected' : '',
                                !layer.visible ? 'layer-item--hidden' : '',
                                isDragOver ? 'layer-item--drag-over' : '',
                            ].join(' ')}
                            onClick={() => selectLayer(isSelected ? null : layer.id)}
                            draggable
                            onDragStart={(e) => onDragStart(e, actualIdx)}
                            onDragOver={(e) => onDragOver(e, actualIdx)}
                            onDrop={(e) => onDrop(e, actualIdx)}
                            onDragEnd={onDragEnd}
                            onDragLeave={() => setDragOverIdx(null)}
                        >
                            <span className="layer-item__drag">⠿</span>

                            <span className="layer-item__badge">{LAYER_TYPE_ICONS[layer.type]}</span>

                            {/* Inline rename */}
                            {editingId === layer.id ? (
                                <input
                                    autoFocus
                                    className="layer-item__name-input"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onBlur={commitRename}
                                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null) }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span
                                    className="layer-item__name"
                                    onDoubleClick={(e) => startRename(e, layer)}
                                    title="Double-click to rename"
                                >
                                    {layer.name}
                                </span>
                            )}

                            {/* Blend mode badge — click to cycle */}
                            <button
                                className={`layer-item__blend layer-item__blend--${layer.blendMode}`}
                                onClick={(e) => cycleBlend(e, layer)}
                                title={`Blend: ${layer.blendMode} (click to cycle)`}
                            >
                                {BLEND_LABELS[layer.blendMode]}
                            </button>

                            {/* Visibility */}
                            <button
                                className="layer-item__vis"
                                onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id) }}
                                title={layer.visible ? 'Hide layer' : 'Show layer'}
                            >
                                {layer.visible ? '◉' : '○'}
                            </button>

                            {/* Delete */}
                            <button
                                className="layer-item__del"
                                onClick={(e) => { e.stopPropagation(); removeLayer(layer.id) }}
                                title="Remove layer"
                            >
                                ✕
                            </button>
                        </div>
                    )
                })}

                {layers.length === 0 && (
                    <div className="layer-stack__empty">No layers — add one below</div>
                )}
            </div>

            {/* Add layer */}
            <div className="layer-stack__footer">
                <button
                    className="layer-stack__add-btn"
                    onClick={() => { setShowTypePicker((v) => !v); setShowShaderSubPicker(false) }}
                >
                    + Add Layer
                </button>

                {showTypePicker && !showShaderSubPicker && (
                    <div className="layer-type-picker">
                        {(Object.keys(LAYER_TYPE_ICONS) as LayerType[]).map((type) => (
                            <button
                                key={type}
                                className="layer-type-picker__item"
                                onClick={() => handleAddLayer(type)}
                            >
                                <span className="layer-type-picker__icon">{LAYER_TYPE_ICONS[type]}</span>
                                <span>{LAYER_TYPE_LABELS[type]}</span>
                            </button>
                        ))}
                    </div>
                )}

                {showTypePicker && showShaderSubPicker && (
                    <div className="layer-type-picker">
                        <button
                            className="layer-type-picker__back"
                            onClick={() => setShowShaderSubPicker(false)}
                        >
                            ← Back
                        </button>
                        <button
                            className="layer-type-picker__item"
                            onClick={() => handleAddShaderLayer(createDefaultLayer('shader-plane'))}
                        >
                            <span className="layer-type-picker__icon">▦</span>
                            <span>UV Rotate</span>
                        </button>
                        <button
                            className="layer-type-picker__item"
                            onClick={() => handleAddShaderLayer(createVoidTunnelLayer())}
                        >
                            <span className="layer-type-picker__icon">◎</span>
                            <span>Void Tunnel</span>
                        </button>
                        <button
                            className="layer-type-picker__item"
                            onClick={() => handleAddShaderLayer(createGlitchMatrixLayer())}
                        >
                            <span className="layer-type-picker__icon">▤</span>
                            <span>Glitch Matrix</span>
                        </button>
                        <button
                            className="layer-type-picker__item"
                            onClick={() => handleAddShaderLayer(createTerrainLayer())}
                        >
                            <span className="layer-type-picker__icon">▲</span>
                            <span>Terrain</span>
                        </button>
                    </div>
                )}

                {/* Preset actions */}
                <div className="layer-stack__preset-actions">
                    <button
                        className="preset-action-btn"
                        onClick={() => {
                            const json = usePresetStore.getState().exportPreset(activePreset.id)
                            if (json) navigator.clipboard.writeText(json)
                        }}
                    >
                        Export
                    </button>
                    <button
                        className="preset-action-btn"
                        onClick={() => usePresetStore.getState().duplicatePreset(activePreset.id)}
                    >
                        Duplicate
                    </button>
                    <button
                        className="preset-action-btn"
                        onClick={async () => {
                            try {
                                const text = await navigator.clipboard.readText()
                                usePresetStore.getState().importPreset(text)
                            } catch { /* clipboard denied */ }
                        }}
                    >
                        Import
                    </button>
                </div>
            </div>
        </div>
    )
}
