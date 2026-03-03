import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TransitionType } from "../types";
import type { EditorState, LayerConfig, ScenePreset } from "../types/layers";

// ─── Audio Refs (mutable, never triggers re-render) ──────────────────

export const audioRefs = {
  bands: new Float32Array(5),
  amplitude: 0,
  beat: false,
  kick: false,
  snare: false,
  hihat: false,
  waveform: new Float32Array(256),
};

// ─── Clock Refs ──────────────────────────────────────────────────────

export const clockRefs = {
  elapsed: 0,
  delta: 0,
  beat: 0,
  bar: 0,
  phrase: 0,
  beatProgress: 0,
};

// ─── Preset Store (replaces SceneStore + EffectStore) ────────────────

interface PresetState {
  presets: Record<string, ScenePreset>;
  activePresetId: string;
  nextPresetId: string | null;
  transitionProgress: number;
  transitionType: TransitionType;
  transitionDuration: number;
  isTransitioning: boolean;
  editor: EditorState;

  // Preset management
  registerPreset: (preset: ScenePreset) => void;
  registerPresets: (presets: ScenePreset[]) => void;
  setActivePreset: (id: string) => void;
  startTransition: (
    nextId: string,
    type?: TransitionType,
    duration?: number,
  ) => void;
  updateTransitionProgress: (progress: number) => void;
  completeTransition: () => void;
  savePreset: (preset: ScenePreset) => void;
  deletePreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;
  addBlankPreset: () => ScenePreset;
  duplicatePreset: (id: string) => ScenePreset | null;
  exportPreset: (id: string) => string | null;
  importPreset: (json: string) => ScenePreset | null;

  // Layer CRUD
  addLayer: (layer: LayerConfig) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, updates: Partial<LayerConfig>) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  toggleLayerVisibility: (layerId: string) => void;

  // Editor
  selectLayer: (layerId: string | null) => void;

  // Preset effects/transition
  setPresetEffects: (effects: ScenePreset["effects"]) => void;
  setPresetTransition: (transition: ScenePreset["transition"]) => void;
}

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      presets: {},
      activePresetId: "neural-mesh",
      nextPresetId: null,
      transitionProgress: 0,
      transitionType: "crossfade",
      transitionDuration: 2.0,
      isTransitioning: false,
      editor: {
        selectedLayerId: null,
      },

      registerPreset: (preset) =>
        set((s) => ({
          presets: { ...s.presets, [preset.id]: preset },
        })),

      registerPresets: (presets) =>
        set((s) => {
          const updated = { ...s.presets };
          for (const p of presets) updated[p.id] = p;
          return { presets: updated };
        }),

      setActivePreset: (id) => set({ activePresetId: id }),

      startTransition: (nextId, type, duration) => {
        const s = get();
        if (s.isTransitioning || nextId === s.activePresetId) return;
        set({
          nextPresetId: nextId,
          transitionProgress: 0,
          transitionType: type ?? s.transitionType,
          transitionDuration: duration ?? s.transitionDuration,
          isTransitioning: true,
        });
      },

      updateTransitionProgress: (progress) =>
        set({ transitionProgress: progress }),

      completeTransition: () => {
        const s = get();
        set({
          activePresetId: s.nextPresetId ?? s.activePresetId,
          nextPresetId: null,
          transitionProgress: 0,
          isTransitioning: false,
        });
      },

      savePreset: (preset) =>
        set((s) => ({
          presets: { ...s.presets, [preset.id]: preset },
        })),

      deletePreset: (id) =>
        set((s) => {
          const preset = s.presets[id];
          if (!preset) return s;
          // Prevent deleting the last remaining preset
          if (Object.keys(s.presets).length <= 1) return s;
          const { [id]: _, ...rest } = s.presets;
          void _;
          // If we deleted the active preset, switch to first remaining
          const newActiveId = id === s.activePresetId
            ? Object.keys(rest)[0]
            : s.activePresetId;
          return { presets: rest, activePresetId: newActiveId };
        }),

      renamePreset: (id, name) =>
        set((s) => {
          const preset = s.presets[id];
          if (!preset) return s;
          return { presets: { ...s.presets, [id]: { ...preset, name } } };
        }),

      addBlankPreset: () => {
        const id = `scene-${Date.now()}`;
        const newPreset: ScenePreset = {
          id,
          name: "New Scene",
          layers: [],
          effects: [],
          transition: { type: "crossfade", duration: 2.0 },
          tags: [],
          builtIn: false,
        };
        set((s) => ({ presets: { ...s.presets, [id]: newPreset } }));
        return newPreset;
      },

      duplicatePreset: (id) => {
        const s = get();
        const source = s.presets[id];
        if (!source) return null;
        const newPreset: ScenePreset = {
          ...structuredClone(source),
          id: `${source.id}-copy-${Date.now()}`,
          name: `${source.name} (Copy)`,
          builtIn: false,
        };
        set((state) => ({
          presets: { ...state.presets, [newPreset.id]: newPreset },
        }));
        return newPreset;
      },

      exportPreset: (id) => {
        const preset = get().presets[id];
        if (!preset) return null;
        return JSON.stringify(preset, null, 2);
      },

      importPreset: (json) => {
        try {
          const preset = JSON.parse(json) as ScenePreset;
          if (!preset.id || !preset.name || !preset.layers) return null;
          preset.builtIn = false;
          if (get().presets[preset.id]) {
            preset.id = `${preset.id}-imported-${Date.now()}`;
          }
          set((s) => ({ presets: { ...s.presets, [preset.id]: preset } }));
          return preset;
        } catch {
          return null;
        }
      },

      addLayer: (layer) =>
        set((s) => {
          const preset = s.presets[s.activePresetId];
          if (!preset) return s;
          const updated = { ...preset, layers: [...preset.layers, layer] };
          return { presets: { ...s.presets, [preset.id]: updated } };
        }),

      removeLayer: (layerId) =>
        set((s) => {
          const preset = s.presets[s.activePresetId];
          if (!preset) return s;
          const updated = {
            ...preset,
            layers: preset.layers.filter((l) => l.id !== layerId),
          };
          return { presets: { ...s.presets, [preset.id]: updated } };
        }),

      updateLayer: (layerId, updates) =>
        set((s) => {
          const preset = s.presets[s.activePresetId];
          if (!preset) return s;
          const updated = {
            ...preset,
            layers: preset.layers.map((l) =>
              l.id === layerId ? { ...l, ...updates } as LayerConfig : l
            ),
          };
          return { presets: { ...s.presets, [preset.id]: updated } };
        }),

      reorderLayers: (fromIndex, toIndex) =>
        set((s) => {
          const preset = s.presets[s.activePresetId];
          if (!preset) return s;
          const layers = [...preset.layers];
          const [moved] = layers.splice(fromIndex, 1);
          layers.splice(toIndex, 0, moved);
          return {
            presets: { ...s.presets, [preset.id]: { ...preset, layers } },
          };
        }),

      toggleLayerVisibility: (layerId) =>
        set((s) => {
          const preset = s.presets[s.activePresetId];
          if (!preset) return s;
          const updated = {
            ...preset,
            layers: preset.layers.map((l) =>
              l.id === layerId ? { ...l, visible: !l.visible } : l
            ),
          };
          return { presets: { ...s.presets, [preset.id]: updated } };
        }),

      selectLayer: (layerId) =>
        set((s) => ({
          editor: { ...s.editor, selectedLayerId: layerId },
        })),

      setPresetEffects: (effects) =>
        set((s) => {
          const preset = s.presets[s.activePresetId];
          if (!preset) return s;
          return {
            presets: { ...s.presets, [preset.id]: { ...preset, effects } },
          };
        }),

      setPresetTransition: (transition) =>
        set((s) => {
          const preset = s.presets[s.activePresetId];
          if (!preset) return s;
          return {
            presets: { ...s.presets, [preset.id]: { ...preset, transition } },
          };
        }),
    }),
    {
      name: "void-vj-presets",
      partialize: (s) => ({
        presets: s.presets,
        activePresetId: s.activePresetId,
      }),
    },
  ),
);

// ─── Global Control Store ────────────────────────────────────────────

interface GlobalState {
  masterIntensity: number;
  masterHue: number;
  masterSpeed: number;
  bpmOverride: number | null;
  isFullscreen: boolean;
  showControls: boolean;
  showHelp: boolean;
  audioSource: "microphone" | "file";
  audioGain: number;
  audioSmoothing: number;
  beatSensitivity: number;
  audioMonitorOpen: boolean;
  editorOpen: boolean;
  sceneManagerOpen: boolean;

  setMasterIntensity: (v: number) => void;
  setMasterHue: (v: number) => void;
  setMasterSpeed: (v: number) => void;
  setBpmOverride: (v: number | null) => void;
  setIsFullscreen: (v: boolean) => void;
  toggleControls: () => void;
  toggleHelp: () => void;
  setAudioSource: (v: "microphone" | "file") => void;
  setAudioGain: (v: number) => void;
  setAudioSmoothing: (v: number) => void;
  setBeatSensitivity: (v: number) => void;
  setAudioMonitorOpen: (v: boolean) => void;
  toggleAudioMonitor: () => void;
  setEditorOpen: (v: boolean) => void;
  toggleEditor: () => void;
  setSceneManagerOpen: (v: boolean) => void;
  toggleSceneManager: () => void;
}

export const useGlobalStore = create<GlobalState>()(
  persist(
    (set) => ({
      masterIntensity: 1.0,
      masterHue: 0.0,
      masterSpeed: 1.0,
      bpmOverride: null,
      isFullscreen: false,
      showControls: true,
      showHelp: true,
      audioSource: "microphone",
      audioGain: 1.0,
      audioSmoothing: 0.8,
      beatSensitivity: 0.6,
      audioMonitorOpen: false,
      editorOpen: false,
      sceneManagerOpen: false,

      setMasterIntensity: (v) => set({ masterIntensity: v }),
      setMasterHue: (v) => set({ masterHue: v }),
      setMasterSpeed: (v) => set({ masterSpeed: v }),
      setBpmOverride: (v) => set({ bpmOverride: v }),
      setIsFullscreen: (v) => set({ isFullscreen: v }),
      toggleControls: () => set((s) => ({ showControls: !s.showControls })),
      toggleHelp: () => set((s) => ({ showHelp: !s.showHelp })),
      setAudioSource: (v) => set({ audioSource: v }),
      setAudioGain: (v) => set({ audioGain: v }),
      setAudioSmoothing: (v) => set({ audioSmoothing: v }),
      setBeatSensitivity: (v) => set({ beatSensitivity: v }),
      setAudioMonitorOpen: (v) => set({ audioMonitorOpen: v }),
      toggleAudioMonitor: () =>
        set((s) => ({ audioMonitorOpen: !s.audioMonitorOpen })),
      setEditorOpen: (v) => set({ editorOpen: v }),
      toggleEditor: () => set((s) => ({ editorOpen: !s.editorOpen })),
      setSceneManagerOpen: (v) => set({ sceneManagerOpen: v }),
      toggleSceneManager: () =>
        set((s) => ({ sceneManagerOpen: !s.sceneManagerOpen })),
    }),
    {
      name: "void-vj-global",
      partialize: (s) => ({
        masterIntensity: s.masterIntensity,
        masterHue: s.masterHue,
        masterSpeed: s.masterSpeed,
        audioGain: s.audioGain,
        audioSmoothing: s.audioSmoothing,
        beatSensitivity: s.beatSensitivity,
      }),
    },
  ),
);

// Legacy alias removed — all code now uses usePresetStore directly
