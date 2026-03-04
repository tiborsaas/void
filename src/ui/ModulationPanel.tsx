// ─── Modulation Panel ─────────────────────────────────────────────────────────
// Third column in the Scene Editor showing modulation cards for the active preset.
// Each card controls one ModulationConfig: LFO shape, frequency, amplitude, offset,
// audio band selection, waveform preview, enable/disable toggle.

import { usePresetStore } from '../engine/store'
import { ModulationPreview } from './ModulationPreview'
import type {
    ModulationConfig,
    LFOShape,
    AudioSourceBand,
    ModulationSourceType,
} from '../types/layers'

// ─── Constants ───────────────────────────────────────────────────────────────

const LFO_SHAPES: { value: LFOShape; label: string; icon: string }[] = [
    { value: 'sine', label: 'Sine', icon: '∿' },
    { value: 'triangle', label: 'Triangle', icon: '△' },
    { value: 'sawtooth', label: 'Saw', icon: '⟋' },
    { value: 'square', label: 'Square', icon: '⊓' },
    { value: 'random', label: 'Random', icon: '⚄' },
    { value: 'noise', label: 'Noise', icon: '〰' },
]

const AUDIO_BANDS: { value: AudioSourceBand; label: string }[] = [
    { value: 'bass', label: 'Bass' },
    { value: 'lowMid', label: 'Lo Mid' },
    { value: 'mid', label: 'Mid' },
    { value: 'highMid', label: 'Hi Mid' },
    { value: 'treble', label: 'Treble' },
    { value: 'amplitude', label: 'Amp' },
    { value: 'beat', label: 'Beat' },
    { value: 'kick', label: 'Kick' },
    { value: 'snare', label: 'Snare' },
    { value: 'hihat', label: 'HiHat' },
]

const SOURCE_TABS: { value: ModulationSourceType; label: string }[] = [
    { value: 'lfo', label: 'LFO' },
    { value: 'audio', label: 'Audio' },
]

// ─── Frequency presets for quick selection ─────────────────────────────────

const FREQ_PRESETS: { label: string; value: number }[] = [
    { label: '30s', value: 1 / 30 },
    { label: '10s', value: 0.1 },
    { label: '4s', value: 0.25 },
    { label: '2s', value: 0.5 },
    { label: '1s', value: 1 },
    { label: '½s', value: 2 },
    { label: '¼s', value: 4 },
    { label: '⅛s', value: 8 },
]

// ─── Modulation Card ─────────────────────────────────────────────────────────

function ModulationCard({
    mod,
    layerName,
}: {
    mod: ModulationConfig
    layerName: string
}) {
    const updateModulation = usePresetStore((s) => s.updateModulation)
    const removeModulation = usePresetStore((s) => s.removeModulation)

    const update = (patch: Partial<ModulationConfig>) => updateModulation(mod.id, patch)

    return (
        <div className={`modulation-card ${!mod.enabled ? 'modulation-card--disabled' : ''}`}>
            {/* Header */}
            <div className="modulation-card__header">
                <div className="modulation-card__title">
                    <span className="modulation-card__prop-name">{mod.propertyLabel}</span>
                    <span className="modulation-card__layer-name">{layerName}</span>
                </div>
                <div className="modulation-card__actions">
                    <button
                        className={`modulation-card__toggle ${mod.enabled ? 'modulation-card__toggle--on' : ''}`}
                        onClick={() => update({ enabled: !mod.enabled })}
                        title={mod.enabled ? 'Disable' : 'Enable'}
                    >
                        {mod.enabled ? '●' : '○'}
                    </button>
                    <button
                        className="modulation-card__delete"
                        onClick={() => removeModulation(mod.id)}
                        title="Remove modulation"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Waveform preview */}
            <ModulationPreview mod={mod} />

            {/* Source tabs */}
            <div className="mod-source-tabs">
                {SOURCE_TABS.map((tab) => (
                    <button
                        key={tab.value}
                        className={`mod-source-tab ${mod.sourceType === tab.value ? 'mod-source-tab--active' : ''}`}
                        onClick={() => update({ sourceType: tab.value })}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Source-specific controls */}
            {mod.sourceType === 'lfo' ? (
                <LFOControls mod={mod} update={update} />
            ) : (
                <AudioControls mod={mod} update={update} />
            )}

            {/* Common: Amplitude & Offset */}
            <div className="modulation-card__common">
                <ModSlider
                    label="Amp"
                    value={mod.amplitude}
                    min={0}
                    max={2}
                    step={0.01}
                    onChange={(v) => update({ amplitude: v })}
                />
                <ModSlider
                    label="Offset"
                    value={mod.offset}
                    min={-1}
                    max={1}
                    step={0.01}
                    onChange={(v) => update({ offset: v })}
                />
            </div>
        </div>
    )
}

// ─── LFO Controls ────────────────────────────────────────────────────────────

function LFOControls({
    mod,
    update,
}: {
    mod: ModulationConfig
    update: (patch: Partial<ModulationConfig>) => void
}) {
    return (
        <div className="modulation-card__lfo">
            {/* Shape selector */}
            <div className="mod-shape-row">
                {LFO_SHAPES.map((s) => (
                    <button
                        key={s.value}
                        className={`mod-shape-btn ${mod.shape === s.value ? 'mod-shape-btn--active' : ''}`}
                        onClick={() => update({ shape: s.value })}
                        title={s.label}
                    >
                        {s.icon}
                    </button>
                ))}
            </div>

            {/* Frequency */}
            <ModSlider
                label="Freq"
                value={mod.frequency}
                min={0.033}
                max={10}
                step={0.001}
                onChange={(v) => update({ frequency: v })}
                displayValue={formatFreq(mod.frequency)}
            />

            {/* Frequency presets */}
            <div className="mod-freq-presets">
                {FREQ_PRESETS.map((fp) => (
                    <button
                        key={fp.label}
                        className={`mod-freq-preset ${Math.abs(mod.frequency - fp.value) < 0.001 ? 'mod-freq-preset--active' : ''}`}
                        onClick={() => update({ frequency: fp.value })}
                    >
                        {fp.label}
                    </button>
                ))}
            </div>

            {/* Phase */}
            <ModSlider
                label="Phase"
                value={mod.phase}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => update({ phase: v })}
            />
        </div>
    )
}

// ─── Audio Controls ──────────────────────────────────────────────────────────

function AudioControls({
    mod,
    update,
}: {
    mod: ModulationConfig
    update: (patch: Partial<ModulationConfig>) => void
}) {
    return (
        <div className="modulation-card__audio">
            <div className="mod-audio-bands">
                {AUDIO_BANDS.map((band) => (
                    <button
                        key={band.value}
                        className={`mod-audio-band ${mod.audioBand === band.value ? 'mod-audio-band--active' : ''}`}
                        onClick={() => update({ audioBand: band.value })}
                    >
                        {band.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

// ─── Compact slider for modulation params ─────────────────────────────────────

function ModSlider({
    label,
    value,
    min,
    max,
    step,
    onChange,
    displayValue,
}: {
    label: string
    value: number
    min: number
    max: number
    step: number
    onChange: (v: number) => void
    displayValue?: string
}) {
    return (
        <div className="mod-slider">
            <span className="mod-slider__label">{label}</span>
            <input
                className="mod-slider__input"
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
            />
            <span className="mod-slider__value">{displayValue ?? value.toFixed(2)}</span>
        </div>
    )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFreq(hz: number): string {
    if (hz >= 1) return `${hz.toFixed(1)}Hz`
    const period = 1 / hz
    return `${period.toFixed(1)}s`
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function ModulationPanel() {
    const activePreset = usePresetStore((s) => s.presets[s.activePresetId])
    const modulations = activePreset?.modulations ?? []
    const layers = activePreset?.layers ?? []

    // Build a name lookup
    const layerNames: Record<string, string> = {}
    for (const l of layers) {
        layerNames[l.id] = l.name || l.type
    }

    if (modulations.length === 0) {
        return (
            <div className="modulation-panel modulation-panel--empty">
                <div className="modulation-panel__placeholder">
                    <span className="modulation-panel__placeholder-icon">∿</span>
                    <span>Click <strong>+</strong> next to any property to add modulation</span>
                </div>
            </div>
        )
    }

    return (
        <div className="modulation-panel">
            <div className="modulation-panel__header">
                <span className="modulation-panel__title">Modulations</span>
                <span className="modulation-panel__count">{modulations.length}</span>
            </div>
            <div className="modulation-panel__list">
                {modulations.map((mod) => (
                    <ModulationCard
                        key={mod.id}
                        mod={mod}
                        layerName={layerNames[mod.layerId] ?? '?'}
                    />
                ))}
            </div>
        </div>
    )
}
