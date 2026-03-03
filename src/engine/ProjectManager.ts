/**
 * ProjectManager — save/load .void project files.
 *
 * A .void file is a ZIP archive containing:
 *   project.json   — all scenes + global settings metadata
 *   models/<key>   — raw GLB/GLTF blobs referenced by Model3D layers
 *
 * Save strategy (File System Access API where available):
 *   - showSaveProjectPicker  → picker → returns FSFileHandle
 *   - saveProjectToHandle    → overwrites existing handle (no picker)
 *   - downloadProject        → legacy <a> download fallback
 *
 * Additional asset types (images, videos, text, etc.) can be added in
 * future under their own sub-directories.
 */

import JSZip from "jszip";
import type { ScenePreset } from "../types/layers";
import type { VJProject, VJProjectSettings } from "../types";
import { useGlobalStore, usePresetStore } from "./store";
import { modelStorage } from "./ModelStorage";

export const PROJECT_VERSION = "1.0.0";

// ─── File System Access API minimal types ────────────────────────────
// These are in modern lib.dom but not universally present in all TS targets.

export interface FSFileHandle {
    readonly name: string;
    getFile(): Promise<File>;
    createWritable(): Promise<FSWritableStream>;
}

interface FSWritableStream {
    write(data: Blob | string | ArrayBufferLike): Promise<void>;
    close(): Promise<void>;
}

declare global {
    interface Window {
        showSaveFilePicker?(opts?: unknown): Promise<FSFileHandle>;
        showOpenFilePicker?(opts?: unknown): Promise<FSFileHandle[]>;
    }
}

/** True when the browser supports the File System Access API. */
export const hasFSA = typeof window !== "undefined" &&
    "showSaveFilePicker" in window;

// ─── Build ZIP blob ───────────────────────────────────────────────────

/**
 * Collects the current in-memory state and packs it into a .void ZIP blob.
 */
export async function saveProject(name: string): Promise<Blob> {
    const presetState = usePresetStore.getState();
    const globalState = useGlobalStore.getState();

    const settings: VJProjectSettings = {
        masterIntensity: globalState.masterIntensity,
        masterHue: globalState.masterHue,
        masterSpeed: globalState.masterSpeed,
        audioGain: globalState.audioGain,
        audioSmoothing: globalState.audioSmoothing,
        beatSensitivity: globalState.beatSensitivity,
        transitionType: presetState.transitionType,
        transitionDuration: presetState.transitionDuration,
    };

    const modelKeys = await modelStorage.listModels();
    const models: Record<string, string> = {};
    for (const key of modelKeys) {
        const blob = await modelStorage.getModel(key);
        if (blob) models[key] = await blobToBase64(blob);
    }

    const project: VJProject = {
        version: PROJECT_VERSION,
        name,
        createdAt: new Date().toISOString(),
        activeSceneId: presetState.activePresetId,
        scenes: Object.values(presetState.presets) as ScenePreset[],
        settings,
        models,
    };

    const zip = new JSZip();
    zip.file("project.json", JSON.stringify(project, null, 2));
    return zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
    });
}

// ─── Save via File System Access API ─────────────────────────────────

/**
 * Opens a Save As picker and writes the project. Returns the new handle,
 * or null if the user cancelled. Throws on real errors.
 */
export async function showSaveProjectPicker(
    name: string,
): Promise<FSFileHandle | null> {
    if (!window.showSaveFilePicker) return null;
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: `${sanitize(name)}.void`,
            types: [
                {
                    description: "VOID Project",
                    accept: { "application/zip": [".void"] },
                },
            ],
        });
        await _writeToHandle(handle, name);
        return handle;
    } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
            return null;
        }
        throw err;
    }
}

/**
 * Overwrites an existing file handle with the current project state.
 */
export async function saveProjectToHandle(
    handle: FSFileHandle,
    name: string,
): Promise<void> {
    await _writeToHandle(handle, name);
}

async function _writeToHandle(handle: FSFileHandle, name: string) {
    const blob = await saveProject(name);
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
}

// ─── Open via File System Access API ─────────────────────────────────

export interface OpenResult {
    result: LoadResult;
    handle: FSFileHandle;
    fileName: string;
}

/**
 * Shows an open picker, loads the chosen .void file, returns the handle.
 * Returns null if user cancelled. Throws on real errors.
 */
export async function showOpenProjectPicker(): Promise<OpenResult | null> {
    if (!window.showOpenFilePicker) return null;
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [
                {
                    description: "VOID Project",
                    accept: { "application/zip": [".void"] },
                },
            ],
            multiple: false,
        });
        const file = await handle.getFile();
        const result = await loadProjectFile(file);
        return { result, handle, fileName: handle.name };
    } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
            return null;
        }
        throw err;
    }
}

// ─── Legacy download fallback ─────────────────────────────────────────

/**
 * Triggers a browser download of the current project as <name>.void.
 * Used as fallback when File System Access API is unavailable.
 */
export async function downloadProject(name = "project"): Promise<void> {
    const blob = await saveProject(name);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitize(name)}.void`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Load ────────────────────────────────────────────────────────────

export interface LoadResult {
    ok: boolean;
    project?: VJProject;
    error?: string;
}

/**
 * Parses and restores state from a .void File object.
 */
export async function loadProjectFile(file: File): Promise<LoadResult> {
    try {
        const zip = await JSZip.loadAsync(file);

        const jsonFile = zip.file("project.json");
        if (!jsonFile) {
            return { ok: false, error: "No project.json found in archive." };
        }

        const jsonText = await jsonFile.async("string");
        const project = JSON.parse(jsonText) as VJProject;

        if (!project.scenes || !Array.isArray(project.scenes)) {
            return {
                ok: false,
                error: "Invalid project.json: missing scenes array.",
            };
        }

        if (project.models) {
            for (const [key, b64] of Object.entries(project.models)) {
                await modelStorage.saveModel(
                    key,
                    base64ToBlob(b64, "model/gltf-binary"),
                );
            }
        }

        const scenes = (project.scenes as ScenePreset[]).map((s) => ({
            ...s,
            builtIn: false,
        }));
        usePresetStore.setState((prev) => {
            const incoming: Record<string, ScenePreset> = {};
            for (const s of scenes) incoming[s.id] = s;
            return {
                presets: incoming,
                activePresetId: project.activeSceneId ?? scenes[0]?.id ??
                    prev.activePresetId,
            };
        });

        if (project.settings) {
            const g = project.settings;
            useGlobalStore.setState({
                masterIntensity: g.masterIntensity ?? 1.0,
                masterHue: g.masterHue ?? 0.0,
                masterSpeed: g.masterSpeed ?? 1.0,
                audioGain: g.audioGain ?? 1.0,
                audioSmoothing: g.audioSmoothing ?? 0.8,
                beatSensitivity: g.beatSensitivity ?? 0.6,
            });
            usePresetStore.setState({
                transitionType: g.transitionType ?? "crossfade",
                transitionDuration: g.transitionDuration ?? 2.0,
            });
        }

        return { ok: true, project };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// ─── New Project ──────────────────────────────────────────────────────

/**
 * Resets all project state to a single blank scene.
 * Does NOT touch the file handle — caller is responsible for clearing that.
 */
export function resetToNewProject(): void {
    const blankId = `scene-${Date.now()}`;
    const blank: ScenePreset = {
        id: blankId,
        name: "Scene 1",
        layers: [],
        effects: [],
        transition: { type: "crossfade", duration: 2.0 },
        tags: [],
        builtIn: false,
    };
    usePresetStore.setState({
        presets: { [blankId]: blank },
        activePresetId: blankId,
        nextPresetId: null,
        isTransitioning: false,
        transitionProgress: 0,
        transitionType: "crossfade",
        transitionDuration: 2.0,
    });
    useGlobalStore.setState({
        masterIntensity: 1.0,
        masterHue: 0.0,
        masterSpeed: 1.0,
        audioGain: 1.0,
        audioSmoothing: 0.8,
        beatSensitivity: 0.6,
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────

function sanitize(name: string): string {
    return name.replace(/[^a-z0-9_-]/gi, "_") || "project";
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            resolve((reader.result as string).split(",")[1] ?? "");
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function base64ToBlob(b64: string, mimeType: string): Blob {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
}
