// ─── Shared Property Field Primitives ────────────────────────────────────────
// Used by all type-specific blocks inside PropertiesPanel.

import type { ShaderUniformDef, ModulationFieldType } from '../../types/layers'
import { usePresetStore } from '../../engine/store'

// ─── Modulation metadata prop ────────────────────────────────────────────────

export interface ModulatableInfo {
    layerId: string
    propertyPath: string
    propertyLabel: string
    fieldType: ModulationFieldType
    /** For select cycling: available option values */
    selectValues?: string[]
}

function ModulateButton({ info }: { info?: ModulatableInfo }) {
    if (!info) return null

    const activePreset = usePresetStore((s) => s.presets[s.activePresetId])
    const addModulation = usePresetStore((s) => s.addModulation)
    const mods = activePreset?.modulations ?? []
    const isModulated = mods.some(
        (m) => m.layerId === info.layerId && m.propertyPath === info.propertyPath && m.enabled,
    )
    const hasAnyMod = mods.some(
        (m) => m.layerId === info.layerId && m.propertyPath === info.propertyPath,
    )

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation()
        addModulation({
            id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            layerId: info.layerId,
            propertyPath: info.propertyPath,
            propertyLabel: info.propertyLabel,
            fieldType: info.fieldType,
            sourceType: 'lfo',
            shape: 'sine',
            frequency: 1,
            phase: 0,
            audioBand: 'amplitude',
            amplitude: 0.5,
            offset: 0,
            enabled: true,
            selectValues: info.selectValues,
        })
    }

    if (hasAnyMod) {
        return (
            <span
                className={`param-modulate-dot ${isModulated ? 'param-modulate-dot--active' : ''}`}
                title="Modulated"
            />
        )
    }

    return (
        <button
            className="param-modulate-btn"
            onClick={handleAdd}
            title={`Modulate ${info.propertyLabel}`}
        >
            +
        </button>
    )
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SliderProps {
    label: string
    value: number
    min: number
    max: number
    step?: number
    onChange: (v: number) => void
    modulatable?: ModulatableInfo
}

interface Vec2Props {
    label: string
    value: [number, number]
    min?: number
    max?: number
    step?: number
    labels?: [string, string]
    onChange: (v: [number, number]) => void
    modulatable?: { layerId: string; basePath: string; baseLabel: string }
}

interface Vec3Props {
    label: string
    value: [number, number, number]
    min?: number
    max?: number
    step?: number
    labels?: [string, string, string]
    onChange: (v: [number, number, number]) => void
    modulatable?: { layerId: string; basePath: string; baseLabel: string }
}

interface ColorProps {
    label: string
    value: string
    onChange: (v: string) => void
    modulatable?: ModulatableInfo
}

interface ToggleProps {
    label: string
    value: boolean
    onChange: (v: boolean) => void
    modulatable?: ModulatableInfo
}

interface SelectProps<T extends string> {
    label: string
    value: T
    options: { value: T; label: string }[]
    onChange: (v: T) => void
    modulatable?: ModulatableInfo
}

interface NumberInputProps {
    label: string
    value: number
    min?: number
    max?: number
    step?: number
    onChange: (v: number) => void
}

interface UniformsEditorProps {
    label?: string
    uniforms: Record<string, ShaderUniformDef>
    onChange: (key: string, value: number) => void
    /** Layer ID + uniform path prefix for modulation support */
    modulatable?: { layerId: string; uniformsPath: string }
}

// ─── SectionTitle ────────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: React.ReactNode }) {
    return <div className="prop-section-title">{children}</div>
}

// ─── SliderField ─────────────────────────────────────────────────────────────

export function SliderField({ label, value, min, max, step = 0.01, onChange, modulatable }: SliderProps) {
    const decimals = step < 0.1 ? 3 : step < 1 ? 2 : 1
    return (
        <div className="param-row">
            <span className="param-label">{label}</span>
            <input
                type="range"
                className="param-slider"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
            />
            <span className="param-value">{value.toFixed(decimals)}</span>
            <ModulateButton info={modulatable} />
        </div>
    )
}

// ─── Vec2Field ───────────────────────────────────────────────────────────────

export function Vec2Field({ label, value, min = -10, max = 10, step = 0.01, labels = ['X', 'Y'], onChange, modulatable }: Vec2Props) {
    return (
        <div className="param-group">
            <div className="param-group-label">{label}</div>
            {([0, 1] as const).map((i) => (
                <div key={i} className="param-row">
                    <span className="param-label param-label--indent">{labels[i]}</span>
                    <input
                        type="range"
                        className="param-slider"
                        min={min}
                        max={max}
                        step={step}
                        value={value[i]}
                        onChange={(e) => {
                            const next = [...value] as [number, number]
                            next[i] = parseFloat(e.target.value)
                            onChange(next)
                        }}
                    />
                    <span className="param-value">{value[i].toFixed(2)}</span>
                    {modulatable && (
                        <ModulateButton info={{
                            layerId: modulatable.layerId,
                            propertyPath: `${modulatable.basePath}.${i}`,
                            propertyLabel: `${modulatable.baseLabel} ${labels[i]}`,
                            fieldType: 'vec-component',
                        }} />
                    )}
                </div>
            ))}
        </div>
    )
}

// ─── Vec3Field ───────────────────────────────────────────────────────────────

export function Vec3Field({ label, value, min = -10, max = 10, step = 0.01, labels = ['X', 'Y', 'Z'], onChange, modulatable }: Vec3Props) {
    return (
        <div className="param-group">
            <div className="param-group-label">{label}</div>
            {([0, 1, 2] as const).map((i) => (
                <div key={i} className="param-row">
                    <span className="param-label param-label--indent">{labels[i]}</span>
                    <input
                        type="range"
                        className="param-slider"
                        min={min}
                        max={max}
                        step={step}
                        value={value[i]}
                        onChange={(e) => {
                            const next = [...value] as [number, number, number]
                            next[i] = parseFloat(e.target.value)
                            onChange(next)
                        }}
                    />
                    <span className="param-value">{value[i].toFixed(2)}</span>
                    {modulatable && (
                        <ModulateButton info={{
                            layerId: modulatable.layerId,
                            propertyPath: `${modulatable.basePath}.${i}`,
                            propertyLabel: `${modulatable.baseLabel} ${labels[i]}`,
                            fieldType: 'vec-component',
                        }} />
                    )}
                </div>
            ))}
        </div>
    )
}

// ─── ColorField ──────────────────────────────────────────────────────────────

export function ColorField({ label, value, onChange, modulatable }: ColorProps) {
    return (
        <div className="param-row">
            <span className="param-label">{label}</span>
            <div className="param-color-wrap">
                <input
                    type="color"
                    className="param-color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
                <span className="param-value">{value}</span>
            </div>
            <ModulateButton info={modulatable} />
        </div>
    )
}

// ─── ToggleField ─────────────────────────────────────────────────────────────

export function ToggleField({ label, value, onChange, modulatable }: ToggleProps) {
    return (
        <div className="param-row">
            <span className="param-label">{label}</span>
            <button
                className={`param-toggle ${value ? 'param-toggle--on' : ''}`}
                onClick={() => onChange(!value)}
                aria-label={label}
            />
            <ModulateButton info={modulatable} />
        </div>
    )
}

// ─── SelectField ─────────────────────────────────────────────────────────────

export function SelectField<T extends string>({ label, value, options, onChange, modulatable }: SelectProps<T>) {
    return (
        <div className="param-row">
            <span className="param-label">{label}</span>
            <select
                className="param-select"
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
            <ModulateButton info={modulatable} />
        </div>
    )
}

// ─── NumberField ─────────────────────────────────────────────────────────────

export function NumberField({ label, value, min, max, step = 1, onChange }: NumberInputProps) {
    return (
        <div className="param-row">
            <span className="param-label">{label}</span>
            <input
                type="number"
                className="param-number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onChange(parseFloat(e.target.value))}
            />
        </div>
    )
}

// ─── TextareaField ───────────────────────────────────────────────────────────

export function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="param-col">
            <span className="param-label">{label}</span>
            <textarea
                className="param-textarea"
                value={value}
                rows={3}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    )
}

// ─── TextInputField ──────────────────────────────────────────────────────────

export function TextInputField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <div className="param-row">
            <span className="param-label">{label}</span>
            <input
                type="text"
                className="param-text"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    )
}

// ─── UniformsEditor ─────────────────────────────────────────────────────────
// Auto-generates sliders from a Record<string, ShaderUniformDef>.
// Only renders numeric uniforms (number type with min/max).

export function UniformsEditor({ label, uniforms, onChange, modulatable }: UniformsEditorProps) {
    const entries = Object.entries(uniforms).filter(
        ([, def]) => typeof def.value === 'number' && def.min !== undefined && def.max !== undefined,
    )

    if (entries.length === 0) return null

    return (
        <div className="param-group">
            {label && <div className="param-group-label">{label}</div>}
            {entries.map(([key, def]) => (
                <SliderField
                    key={key}
                    label={def.label ?? key}
                    value={def.value as number}
                    min={def.min!}
                    max={def.max!}
                    step={def.step ?? 0.01}
                    onChange={(v) => onChange(key, v)}
                    modulatable={modulatable ? {
                        layerId: modulatable.layerId,
                        propertyPath: `${modulatable.uniformsPath}.${key}.value`,
                        propertyLabel: def.label ?? key,
                        fieldType: 'number',
                    } : undefined}
                />
            ))}
        </div>
    )
}
