// ─── Hydra Code Editor ───────────────────────────────────────────────────────
// Large floating modal for editing Hydra sketch code with live preview.
// The 3D canvas remains visible behind the overlay.

import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
    layerId: string
    initialCode: string
    onRun: (code: string) => void
    onClose: () => void
}

const EXAMPLE_SKETCHES = [
    {
        label: 'Kaleidoscope', code: `osc(60, 0.1, 1.4)
  .kaleid(4)
  .color(0.9, 0.2, 0.8)
  .out()` },
    {
        label: 'Liquid Feedback', code: `osc(10, 0.2, 0.8)
  .diff(o0)
  .modulate(noise(3), 0.4)
  .out(o0)` },
    {
        label: 'Voronoi Pulse', code: `voronoi(5, 0.3, 0.3)
  .color(0.2, 0.8, 1.0)
  .modulate(osc(4, 0.1), 0.3)
  .kaleid(6)
  .out()` },
    {
        label: 'Neon Tunnel', code: `shape(4, 0.9, 0.01)
  .repeat(3, 3)
  .rotate(() => time * 0.5)
  .color(0.0, 1.0, 0.8)
  .diff(
    shape(3, 0.5, 0.01)
      .rotate(() => -time * 0.3)
      .color(1.0, 0.0, 0.6)
  )
  .out()` },
    {
        label: 'Noise Field', code: `noise(4, 0.4, 0.1)
  .colorama(0.3)
  .out()` },
    {
        label: 'Gradient Warp', code: `gradient(1)
  .modulate(noise(3, 0.5), 0.4)
  .hue(() => time * 0.1)
  .out()` },
]

export function HydraCodeEditor({ layerId: _layerId, initialCode, onRun, onClose }: Props) {
    const [code, setCode] = useState(initialCode)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Focus the textarea when opened
    useEffect(() => {
        textareaRef.current?.focus()
        textareaRef.current?.setSelectionRange(0, 0)
    }, [])

    const handleRun = useCallback(() => {
        onRun(code)
        onClose()
    }, [code, onRun, onClose])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Ctrl/Cmd + Enter → run & close
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            handleRun()
            return
        }
        // Tab → insert 2 spaces
        if (e.key === 'Tab') {
            e.preventDefault()
            const ta = textareaRef.current
            if (!ta) return
            const start = ta.selectionStart
            const end = ta.selectionEnd
            const next = code.slice(0, start) + '  ' + code.slice(end)
            setCode(next)
            requestAnimationFrame(() => {
                ta.selectionStart = ta.selectionEnd = start + 2
            })
        }
    }, [code, handleRun])

    const handleOverlayKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
    }, [onClose])

    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        // Close if clicking the dark backdrop (not the panel itself)
        if (e.target === e.currentTarget) onClose()
    }, [onClose])

    return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
            className="hydra-editor-overlay"
            onKeyDown={handleOverlayKeyDown}
            onClick={handleOverlayClick}
        >
            <div className="hydra-editor-panel">
                {/* Header */}
                <div className="hydra-editor-header">
                    <span className="hydra-editor-logo">〰 Hydra Synth</span>
                    <div className="hydra-editor-header-actions">
                        <span className="hydra-editor-hint">
                            <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to apply
                        </span>
                        <button
                            className="hydra-editor-run-btn"
                            onClick={handleRun}
                            title="Apply code (Ctrl+Enter)"
                        >
                            ▶ Run
                        </button>
                        <button
                            className="hydra-editor-close-btn"
                            onClick={onClose}
                            title="Close without applying (Escape)"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Two-column body: examples sidebar + editor */}
                <div className="hydra-editor-body">
                    {/* Example sketches sidebar */}
                    <div className="hydra-editor-sidebar">
                        <div className="hydra-editor-sidebar-title">EXAMPLES</div>
                        {EXAMPLE_SKETCHES.map((ex) => (
                            <button
                                key={ex.label}
                                className="hydra-editor-example-btn"
                                onClick={() => setCode(ex.code)}
                                title={ex.code}
                            >
                                {ex.label}
                            </button>
                        ))}
                        <div className="hydra-editor-sidebar-divider" />
                        <div className="hydra-editor-sidebar-title">REFERENCES</div>
                        <a
                            className="hydra-editor-ref-link"
                            href="https://hydra.ojack.xyz/api/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            API Docs ↗
                        </a>
                        <a
                            className="hydra-editor-ref-link"
                            href="https://hydra.ojack.xyz/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Web Editor ↗
                        </a>
                    </div>

                    {/* Code textarea */}
                    <div className="hydra-editor-code-area">
                        <textarea
                            ref={textareaRef}
                            className="hydra-editor-textarea"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            onKeyDown={handleKeyDown}
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="off"
                            placeholder={`// Hydra sketch code\nosc(60, 0.1, 1.4).kaleid(4).out()`}
                        />
                    </div>
                </div>

                {/* Footer status bar */}
                <div className="hydra-editor-footer">
                    <span className="hydra-editor-footer-note">
                        Available: osc · noise · voronoi · gradient · shape · src · o0–o3 · s0–s3 · time · mouse
                    </span>
                </div>
            </div>
        </div>
    )
}
