// SceneEditor — floating panel that composes the LayerStack (left),
// PropertiesPanel (center) and ModulationPanel (right) into a single
// draggable editor window.
import { useState, useRef, useCallback } from 'react'
import { useGlobalStore } from '../engine/store'
import { LayerStack } from './LayerStack'
import { PropertiesPanel } from './PropertiesPanel'
import { ModulationPanel } from './ModulationPanel'

export function SceneEditor() {
    const editorOpen = useGlobalStore((s) => s.editorOpen)
    const setEditorOpen = useGlobalStore((s) => s.setEditorOpen)

    // Track drag offset from the default centered position
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const dragRef = useRef<{
        startMX: number; startMY: number
        startOX: number; startOY: number
    } | null>(null)

    const onHeaderMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        // Don't drag if clicking the close button
        if ((e.target as HTMLElement).closest('button')) return
        e.preventDefault()
        dragRef.current = {
            startMX: e.clientX, startMY: e.clientY,
            startOX: offset.x, startOY: offset.y,
        }
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

    if (!editorOpen) return null

    return (
        <div
            className="scene-editor-panel"
            style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
        >
            {/* Drag handle header */}
            <div className="scene-editor-panel__header" onMouseDown={onHeaderMouseDown}>
                <span className="scene-editor-panel__drag-hint">⠿</span>
                <span className="scene-editor-panel__title">Scene Editor</span>
                <button
                    className="scene-editor-panel__close"
                    onClick={() => setEditorOpen(false)}
                    title="Close editor"
                >
                    ✕
                </button>
            </div>

            {/* Three-column body */}
            <div className="scene-editor-panel__body">
                <LayerStack />
                <PropertiesPanel />
                <ModulationPanel />
            </div>
        </div>
    )
}
