import type { FC } from "react";

// ─── Parameter Descriptors ───────────────────────────────────────────

export type ParamType = "number" | "color" | "boolean" | "select";

export interface NumberParam {
  type: "number";
  default: number;
  min: number;
  max: number;
  step?: number;
  label?: string;
}

export interface ColorParam {
  type: "color";
  default: string;
  label?: string;
}

export interface BooleanParam {
  type: "boolean";
  default: boolean;
  label?: string;
}

export interface SelectParam {
  type: "select";
  default: string;
  options: string[];
  label?: string;
}

export type ParamDescriptor =
  | NumberParam
  | ColorParam
  | BooleanParam
  | SelectParam;

// ─── Audio Data ──────────────────────────────────────────────────────

export interface AudioData {
  /** 5-band frequency data: bass, lowMid, mid, highMid, treble (0-1) */
  bands: Float32Array;
  /** Overall amplitude 0-1 */
  amplitude: number;
  /** True on beat detection frame */
  beat: boolean;
  /** Raw waveform data */
  waveform: Float32Array;
  /** Kick detection */
  kick: boolean;
  /** Snare detection */
  snare: boolean;
  /** Hi-hat detection */
  hihat: boolean;
}

// ─── Effect Presets ──────────────────────────────────────────────────

export interface EffectPreset {
  name: string;
  enabled: boolean;
  params: Record<string, number | boolean | string>;
}

// ─── Scene System ────────────────────────────────────────────────────

export interface SceneProps {
  /** Whether this scene is currently active (not transitioning out) */
  isActive: boolean;
  /** Transition progress 0-1 if fading in, undefined if fully active */
  transitionIn?: number;
}

export interface SceneDescriptor {
  id: string;
  name: string;
  component: FC<SceneProps>;
  defaultParams: Record<string, ParamDescriptor>;
  defaultEffects: EffectPreset[];
  tags: string[];
}

// ─── Transition Types ────────────────────────────────────────────────

export type TransitionType =
  | "crossfade"
  | "dissolve"
  | "glitch-cut"
  | "zoom-blur"
  | "instant";

// ─── Clock ───────────────────────────────────────────────────────────

export interface ClockData {
  /** Total elapsed time in seconds */
  elapsed: number;
  /** Current beat number */
  beat: number;
  /** Current bar (4 beats) */
  bar: number;
  /** Current phrase (8 bars) */
  phrase: number;
  /** Fractional beat position within current beat (0-1) */
  beatProgress: number;
  /** Delta time since last frame */
  delta: number;
}

// ─── Audio Source ─────────────────────────────────────────────────────

export type AudioSource = "microphone" | "file";

// ─── Project ────────────────────────────────────────────────────────

export interface VJProjectSettings {
  masterIntensity: number;
  masterHue: number;
  masterSpeed: number;
  audioGain: number;
  audioSmoothing: number;
  beatSensitivity: number;
  transitionType: TransitionType;
  transitionDuration: number;
}

/**
 * Serialisable project bundle saved into a .void ZIP.
 * models: Record<modelKey, base64-encoded GLB blob>
 */
export interface VJProject {
  version: string;
  name: string;
  createdAt: string;
  activeSceneId: string;
  scenes: unknown[]; // ScenePreset[] — imported at runtime to avoid circular deps
  settings: VJProjectSettings;
  models: Record<string, string>;
}
