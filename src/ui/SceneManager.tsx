/**
 * SceneManager — floating, draggable project & scene management panel.
 *
 * Project file handling:
 *  - Open:    File System Access API picker (fallback: <input type=file>)
 *  - Save:    overwrites the currently open file handle (if any)
 *  - Save As: always opens a picker / triggers download
 *  - New:     warns on unsaved changes, resets to blank project
 *
 * Dirty tracking: subscribes to preset store — any mutation after
 * open/save marks the project as modified (●).
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { usePresetStore, useGlobalStore } from '../engine/store'
import {
    hasFSA,
    showSaveProjectPicker,
    saveProjectToHandle,
    showOpenProjectPicker,
    downloadProject,
    loadProjectFile,
    resetToNewProject,
} from '../engine/ProjectManager'
import type { FSFileHandle } from '../engine/ProjectManager'
import type { TransitionType } from '../types'

const TRANSITION_TYPES: TransitionType[] = ['crossfade', 'dissolve', 'glitch-cut', 'zoom-blur', 'instant']

export function SceneManager() {
    const open = useGlobalStore((s) => s.sceneManagerOpen)
    const setOpen = useGlobalStore((s) => s.setSceneManagerOpen)

    const presets = usePresetStore((s) => s.presets)
    const activePresetId = usePresetStore((s) => s.activePresetId)
    const transitionType = usePresetStore((s) => s.transitionType)
    const startTransition = usePresetStore((s) => s.startTransition)
    const duplicatePreset = usePresetStore((s) => s.duplicatePreset)
    const deletePreset = usePresetStore((s) => s.deletePreset)
    const renamePreset = usePresetStore((s) => s.renamePreset)
    const addBlankPreset = usePresetStore((s) => s.addBlankPreset)

    // ── File state ───────────────────────────────────────────────────
    const [fileHandle, setFileHandle] = useState<FSFileHandle | null>(null)
    // Note: File System Access API exposes only the filename, not the full
    // filesystem path (browser security restriction).
    // projectName doubles as the filename without .void extension.
    const [projectName, setProjectName] = useState<string>('My Project')
    const [isDirty, setIsDirty] = useState(false)
    // Track mount so first hydration doesn't mark dirty
    const mountedRef = useRef(false)

    // Subscribe to preset store changes — any mutation after mount = dirty
    useEffect(() => {
        mountedRef.current = true
        const unsub = usePresetStore.subscribe(() => {
            if (mountedRef.current) setIsDirty(true)
        })
        return () => { unsub(); mountedRef.current = false }
    }, [])

    const markClean = () => setIsDirty(false)

    // ── Draggable window ─────────────────────────────────────────────
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const dragRef = useRef<{ startMX: number; startMY: number; startOX: number; startOY: number } | null>(null)

    const onHeaderMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button, input')) return
        e.preventDefault()
        dragRef.current = { startMX: e.clientX, startMY: e.clientY, startOX: offset.x, startOY: offset.y }
        const onMove = (ev: MouseEvent) => {
            if (!dragRef.current) return
            setOffset({
                x: dragRef.current.startOX + ev.clientX - dragRef.current.startMX,
                y: dragRef.current.startOY + ev.clientY - dragRef.current.startMY,
            })
        }
        const onUp = () => {
            dragRef.current = null
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [offset])

    // ── Inline rename ─────────────────────────────────────────────────
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const renameInputRef = useRef<HTMLInputElement>(null)

    const startRename = (id: string, currentName: string) => {
        setRenamingId(id)
        setRenameValue(currentName)
    }
    const commitRename = () => {
        if (renamingId && renameValue.trim()) renamePreset(renamingId, renameValue.trim())
        setRenamingId(null)
    }
    useEffect(() => {
        if (renamingId && renameInputRef.current) {
            renameInputRef.current.focus()
            renameInputRef.current.select()
        }
    }, [renamingId])

    // ── Confirm delete ────────────────────────────────────────────────
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    // ── Confirm new/open (unsaved changes warning) ────────────────────
    const [confirmAction, setConfirmAction] = useState<'new' | 'open' | null>(null)

    // ── Transition ────────────────────────────────────────────────────
    const cycleTransition = () => {
        const idx = TRANSITION_TYPES.indexOf(transitionType)
        usePresetStore.setState({ transitionType: TRANSITION_TYPES[(idx + 1) % TRANSITION_TYPES.length] })
    }

    // ── Status / error ────────────────────────────────────────────────
    const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null)
    const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const showStatus = (text: string, ok = true) => {
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
        setStatusMsg({ text, ok })
        statusTimerRef.current = setTimeout(() => setStatusMsg(null), 3500)
    }

    // ── Legacy file input (fallback Open when no FSA) ─────────────────
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Derive the filename shown in the UI from projectName
    const voidFileName = `${projectName}.void`

    // ── Save (overwrite or first save) ────────────────────────────────
    const handleSave = async () => {
        try {
            if (fileHandle) {
                // Overwrite the existing file
                await saveProjectToHandle(fileHandle, projectName)
                markClean()
                showStatus(`Saved → ${voidFileName}`)
            } else if (hasFSA) {
                // First save — show picker
                const handle = await showSaveProjectPicker(projectName)
                if (handle) {
                    setFileHandle(handle)
                    setProjectName(handle.name.replace(/\.void$/i, ''))
                    markClean()
                    showStatus(`Saved → ${handle.name}`)
                }
            } else {
                // Fallback: download
                await downloadProject(projectName)
                markClean()
                showStatus('Downloaded ✓')
            }
        } catch (err) {
            showStatus(err instanceof Error ? err.message : String(err), false)
        }
    }

    // ── Save As ───────────────────────────────────────────────────────
    const handleSaveAs = async () => {
        try {
            if (hasFSA) {
                const handle = await showSaveProjectPicker(projectName)
                if (handle) {
                    setFileHandle(handle)
                    setProjectName(handle.name.replace(/\.void$/i, ''))
                    markClean()
                    showStatus(`Saved → ${handle.name}`)
                }
            } else {
                await downloadProject(projectName)
                markClean()
                showStatus('Downloaded ✓')
            }
        } catch (err) {
            showStatus(err instanceof Error ? err.message : String(err), false)
        }
    }

    // ── Open ──────────────────────────────────────────────────────────
    const doOpen = async () => {
        try {
            if (hasFSA) {
                const opened = await showOpenProjectPicker()
                if (!opened) return
                if (!opened.result.ok) {
                    showStatus(opened.result.error ?? 'Load failed', false)
                    return
                }
                setProjectName(opened.handle.name.replace(/\.void$/i, ''))
                setFileHandle(opened.handle)
                markClean()
                showStatus(`Opened → ${opened.handle.name}`)
            } else {
                fileInputRef.current?.click()
            }
        } catch (err) {
            showStatus(err instanceof Error ? err.message : String(err), false)
        }
    }

    const handleOpenClick = () => {
        if (isDirty) {
            setConfirmAction('open')
        } else {
            doOpen()
        }
    }

    // Legacy <input> handler (non-FSA browsers)
    const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const result = await loadProjectFile(file)
        if (!result.ok) {
            showStatus(result.error ?? 'Load failed', false)
        } else {
            setProjectName(file.name.replace(/\.void$/i, ''))
            setFileHandle(null)
            markClean()
            showStatus(`Opened → ${file.name}`)
        }
        e.target.value = ''
    }

    // ── New Project ───────────────────────────────────────────────────
    const doNewProject = () => {
        resetToNewProject()
        setFileHandle(null)
        setProjectName('My Project')
        setIsDirty(false)
        showStatus('New project created')
    }

    const handleNewProjectClick = () => {
        if (isDirty) {
            setConfirmAction('new')
        } else {
            doNewProject()
        }
    }

    // ── Scene actions ─────────────────────────────────────────────────
    const handleAddScene = () => {
        const preset = addBlankPreset()
        startRename(preset.id, preset.name)
    }

    if (!open) return null

    const presetList = Object.values(presets)

    return (
        <div
            className="scene-manager-panel"
            style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
        >
            {/* ── Header ── */}
            <div className="scene-manager-panel__header" onMouseDown={onHeaderMouseDown}>
                <span className="scene-manager-panel__drag-hint">⠿</span>
                <span className="scene-manager-panel__title">
                    Scene Manager
                    {isDirty && <span className="scene-manager-panel__dirty" title="Unsaved changes"> ●</span>}
                </span>
                <button className="scene-manager-panel__close" onClick={() => setOpen(false)} title="Close (P)">✕</button>
            </div>

            {/* ── Unsaved changes confirm overlay ── */}
            {confirmAction && (
                <div className="scene-manager__confirm-overlay">
                    <div className="scene-manager__confirm-box">
                        <p className="scene-manager__confirm-msg">
                            You have unsaved changes.<br />
                            {confirmAction === 'new'
                                ? 'Create a new project and discard them?'
                                : 'Open another file and discard them?'}
                        </p>
                        <div className="scene-manager__confirm-actions">
                            <button
                                className="scene-manager__footer-btn scene-manager__footer-btn--danger"
                                onClick={() => {
                                    const action = confirmAction
                                    setConfirmAction(null)
                                    if (action === 'new') doNewProject()
                                    else doOpen()
                                }}
                            >Discard & Continue</button>
                            <button
                                className="scene-manager__footer-btn"
                                onClick={() => setConfirmAction(null)}
                            >Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Body ── */}
            <div className="scene-manager-panel__body">

                {/* Project info row */}
                <div className="scene-manager__project-row">
                    <span className="scene-manager__project-label">Project</span>
                    <input
                        className="scene-manager__project-name"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Project name…"
                        spellCheck={false}
                    />
                    <button
                        className="scene-manager__transition-btn"
                        onClick={cycleTransition}
                        title={`Default transition: ${transitionType}`}
                    >⇌ {transitionType}</button>
                </div>

                {/* File location row */}
                <div className="scene-manager__file-row">
                    {fileHandle ? (
                        <>
                            <span className="scene-manager__file-icon">📄</span>
                            <span
                                className="scene-manager__file-name"
                                title={`${voidFileName}\n(Full filesystem path is unavailable in browsers)`}
                            >
                                {voidFileName}
                            </span>
                            {isDirty && <span className="scene-manager__file-dirty">unsaved changes</span>}
                        </>
                    ) : (
                        <span className="scene-manager__file-unsaved">
                            {isDirty ? `● ${voidFileName} — unsaved` : 'New project (not yet saved)'}
                        </span>
                    )}
                </div>

                {/* Scene list */}
                <div className="scene-manager__list">
                    {presetList.length === 0 && (
                        <div className="scene-manager__empty">No scenes yet — add one below.</div>
                    )}
                    {presetList.map((preset, idx) => {
                        const isActive = preset.id === activePresetId

                        return (
                            <div
                                key={preset.id}
                                className={`scene-manager__card${isActive ? ' scene-manager__card--active' : ''}`}
                            >
                                <span className="scene-manager__card-num">{idx + 1}</span>

                                {renamingId === preset.id ? (
                                    <input
                                        ref={renameInputRef}
                                        className="scene-manager__rename-input"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={commitRename}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') commitRename()
                                            if (e.key === 'Escape') setRenamingId(null)
                                        }}
                                        maxLength={40}
                                    />
                                ) : (
                                    <span
                                        className="scene-manager__card-name"
                                        onDoubleClick={() => startRename(preset.id, preset.name)}
                                        title="Double-click to rename"
                                    >
                                        {preset.name}
                                        {preset.builtIn && (
                                            <span className="scene-manager__card-builtin" title="Factory preset">built-in</span>
                                        )}
                                    </span>
                                )}

                                {preset.tags.length > 0 && (
                                    <span className="scene-manager__card-tags">
                                        {preset.tags.slice(0, 3).join(' · ')}
                                    </span>
                                )}

                                <div className="scene-manager__card-actions">
                                    {!isActive && (
                                        <button
                                            className="scene-manager__icon-btn"
                                            onClick={() => startTransition(preset.id)}
                                            title="Switch to this scene"
                                        >▶</button>
                                    )}
                                    <button
                                        className="scene-manager__icon-btn"
                                        onClick={() => startRename(preset.id, preset.name)}
                                        title="Rename"
                                    >✎</button>
                                    <button
                                        className="scene-manager__icon-btn"
                                        onClick={() => duplicatePreset(preset.id)}
                                        title="Duplicate"
                                    >⧉</button>
                                    {confirmDeleteId === preset.id ? (
                                        <>
                                            <button
                                                className="scene-manager__icon-btn scene-manager__icon-btn--danger"
                                                onClick={() => { deletePreset(preset.id); setConfirmDeleteId(null) }}
                                                title="Confirm delete"
                                            >✓</button>
                                            <button
                                                className="scene-manager__icon-btn"
                                                onClick={() => setConfirmDeleteId(null)}
                                                title="Cancel"
                                            >✕</button>
                                        </>
                                    ) : (
                                        <button
                                            className="scene-manager__icon-btn scene-manager__icon-btn--delete"
                                            onClick={() => setConfirmDeleteId(preset.id)}
                                            title="Delete scene"
                                        >🗑</button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Footer */}
                <div className="scene-manager__footer">

                    {/* Status */}
                    {statusMsg && (
                        <span className={`scene-manager__status scene-manager__status--${statusMsg.ok ? 'ok' : 'err'}`}>
                            {statusMsg.text}
                        </span>
                    )}

                    <button className="scene-manager__footer-btn" onClick={handleAddScene} title="Add blank scene">
                        + Scene
                    </button>

                    <button
                        className="scene-manager__footer-btn scene-manager__footer-btn--warn"
                        onClick={handleNewProjectClick}
                        title="New project — clears all scenes and settings"
                    >
                        New Project
                    </button>

                    <div className="scene-manager__footer-spacer" />

                    {/* Save: overwrite if handle exists, else Save As */}
                    <button
                        className={`scene-manager__footer-btn scene-manager__footer-btn--accent${isDirty ? ' scene-manager__footer-btn--dirty' : ''}`}
                        onClick={handleSave}
                        title={fileHandle ? `Save → ${voidFileName}` : 'Save project…'}
                    >
                        {fileHandle ? '💾 Save' : '💾 Save…'}
                    </button>

                    {/* Save As (always shows picker / download) */}
                    {fileHandle && (
                        <button
                            className="scene-manager__footer-btn"
                            onClick={handleSaveAs}
                            title="Save a copy to a different file"
                        >
                            Save As…
                        </button>
                    )}

                    <button
                        className="scene-manager__footer-btn"
                        onClick={handleOpenClick}
                        title="Open .void project file"
                    >
                        📂 Open
                    </button>

                    {/* Legacy file input — only used when FSA is unavailable */}
                    {!hasFSA && (
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".void"
                            style={{ display: 'none' }}
                            onChange={handleFileInputChange}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}


