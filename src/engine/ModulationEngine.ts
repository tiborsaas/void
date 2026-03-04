// ─── Modulation Engine ──────────────────────────────────────────────
// Evaluates LFO and audio-driven modulations every frame.
// Outputs are stored in mutable refs (same pattern as audioRefs/clockRefs)
// so layers can read modulated offsets without triggering React re-renders.

import { audioRefs, clockRefs } from "./store";
import type {
  AudioSourceBand,
  LFOShape,
  ModulationConfig,
} from "../types/layers";

// ─── Mutable output: layerId → propertyPath → computed offset ───────

export const modulationRefs: Record<string, Record<string, number>> = {};

// ─── Audio band index map ────────────────────────────────────────────

const AUDIO_BAND_INDEX: Record<string, number> = {
  bass: 0,
  lowMid: 1,
  mid: 2,
  highMid: 3,
  treble: 4,
};

// ─── LFO Waveform Functions ─────────────────────────────────────────
// All return values in range [–1, +1]

let noiseValue = 0;
let noiseTimer = 0;

function lfoSine(t: number): number {
  return Math.sin(t * Math.PI * 2);
}

function lfoTriangle(t: number): number {
  const p = ((t % 1) + 1) % 1;
  return p < 0.5 ? p * 4 - 1 : 3 - p * 4;
}

function lfoSawtooth(t: number): number {
  const p = ((t % 1) + 1) % 1;
  return p * 2 - 1;
}

function lfoSquare(t: number): number {
  const p = ((t % 1) + 1) % 1;
  return p < 0.5 ? 1 : -1;
}

function lfoRandom(t: number): number {
  // Stepped random — changes every cycle
  return Math.sin(Math.floor(t) * 127.1 + 311.7) * 2 - 1;
}

function lfoNoise(delta: number): number {
  // Smooth random walk
  noiseTimer += delta;
  if (noiseTimer > 0.05) {
    noiseTimer = 0;
    noiseValue += (Math.random() - 0.5) * 0.3;
    noiseValue *= 0.95; // decay toward center
  }
  return Math.max(-1, Math.min(1, noiseValue));
}

function evaluateLFO(shape: LFOShape, phase: number, delta: number): number {
  switch (shape) {
    case "sine":
      return lfoSine(phase);
    case "triangle":
      return lfoTriangle(phase);
    case "sawtooth":
      return lfoSawtooth(phase);
    case "square":
      return lfoSquare(phase);
    case "random":
      return lfoRandom(phase);
    case "noise":
      return lfoNoise(delta);
  }
}

function getAudioValue(band: AudioSourceBand): number {
  if (band in AUDIO_BAND_INDEX) {
    return audioRefs.bands[AUDIO_BAND_INDEX[band]];
  }
  switch (band) {
    case "amplitude":
      return audioRefs.amplitude;
    case "beat":
      return audioRefs.beat ? 1 : 0;
    case "kick":
      return audioRefs.kick ? 1 : 0;
    case "snare":
      return audioRefs.snare ? 1 : 0;
    case "hihat":
      return audioRefs.hihat ? 1 : 0;
    default:
      return 0;
  }
}

// ─── Static function to evaluate a single waveform for preview ──────

export function evaluateLFOStatic(shape: LFOShape, t: number): number {
  switch (shape) {
    case "sine":
      return lfoSine(t);
    case "triangle":
      return lfoTriangle(t);
    case "sawtooth":
      return lfoSawtooth(t);
    case "square":
      return lfoSquare(t);
    case "random":
      return lfoRandom(t);
    case "noise":
      return lfoSine(t); // approx for preview
  }
}

// ─── Main evaluation — called once per frame from Conductor ─────────

export function evaluateModulations(
  modulations: ModulationConfig[],
  elapsed: number,
  delta: number,
): void {
  // Clear all previous values
  for (const layerId of Object.keys(modulationRefs)) {
    for (const prop of Object.keys(modulationRefs[layerId])) {
      delete modulationRefs[layerId][prop];
    }
  }

  for (const mod of modulations) {
    if (!mod.enabled) continue;

    let raw: number;

    if (mod.sourceType === "lfo") {
      // Compute phase: elapsed * frequency + user phase offset
      const phase = elapsed * mod.frequency + mod.phase;
      raw = evaluateLFO(mod.shape, phase, delta);
    } else {
      // Audio source: value is 0–1 from audioRefs.
      // Use unipolar: silence → raw=0 → no offset. Loud → raw=1 → full amplitude offset.
      raw = getAudioValue(mod.audioBand);
    }

    // Apply amplitude and offset: output = raw * amplitude + offset
    const output = raw * mod.amplitude + mod.offset;

    // Write to modulationRefs
    if (!modulationRefs[mod.layerId]) {
      modulationRefs[mod.layerId] = {};
    }
    // If multiple modulations target the same property, sum them
    modulationRefs[mod.layerId][mod.propertyPath] =
      (modulationRefs[mod.layerId][mod.propertyPath] ?? 0) + output;
  }
}

// ─── Helper to get final modulated value ────────────────────────────

export function getModulatedValue(
  layerId: string,
  propertyPath: string,
  baseValue: number,
  min: number,
  max: number,
): number {
  const offset = modulationRefs[layerId]?.[propertyPath];
  if (offset === undefined) return baseValue;
  return Math.max(min, Math.min(max, baseValue + offset));
}

// ─── Helper for select modulation (quantize to index) ───────────────

export function getModulatedSelect<T extends string>(
  layerId: string,
  propertyPath: string,
  baseValue: T,
  options: T[],
): T {
  const offset = modulationRefs[layerId]?.[propertyPath];
  if (offset === undefined || options.length === 0) return baseValue;
  // Map offset (typically –1..+1) to 0..1 and quantize to option index
  const normalized = (offset + 1) / 2;
  const idx = Math.floor(
    Math.max(0, Math.min(0.999, normalized)) * options.length,
  );
  return options[idx];
}

// ─── Helper for toggle modulation ───────────────────────────────────

export function getModulatedToggle(
  layerId: string,
  propertyPath: string,
  baseValue: boolean,
): boolean {
  const offset = modulationRefs[layerId]?.[propertyPath];
  if (offset === undefined) return baseValue;
  // Positive offset = true, negative = false
  return offset > 0;
}

// ─── Helper for color hue modulation ────────────────────────────────

export function getModulatedColor(
  layerId: string,
  propertyPath: string,
  baseHex: string,
): string {
  const offset = modulationRefs[layerId]?.[propertyPath];
  if (offset === undefined) return baseHex;
  // Parse hex to HSL, shift hue, return hex
  const r = parseInt(baseHex.slice(1, 3), 16) / 255;
  const g = parseInt(baseHex.slice(3, 5), 16) / 255;
  const b = parseInt(baseHex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const s = max === min
    ? 0
    : l > 0.5
    ? (max - min) / (2 - max - min)
    : (max - min) / (max + min);

  if (max !== min) {
    const d = max - min;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  // Shift hue by offset (offset of 1 = full rotation)
  h = ((h + offset) % 1 + 1) % 1;

  // HSL to hex
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let rr: number, gg: number, bb: number;
  if (s === 0) {
    rr = gg = bb = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rr = hue2rgb(p, q, h + 1 / 3);
    gg = hue2rgb(p, q, h);
    bb = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (v: number) =>
    Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

// ─── Check if a property has active modulation ──────────────────────

export function hasModulation(
  modulations: ModulationConfig[],
  layerId: string,
  propertyPath: string,
): boolean {
  return modulations.some(
    (m) =>
      m.layerId === layerId && m.propertyPath === propertyPath && m.enabled,
  );
}
