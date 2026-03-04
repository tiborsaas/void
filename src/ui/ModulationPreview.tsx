// ─── Modulation Preview ──────────────────────────────────────────────────────
// Tiny canvas that draws the LFO waveform in real time, or a bar for audio mode.
// Uses requestAnimationFrame for smooth animation independent of React renders.

import { useRef, useEffect } from 'react'
import { evaluateLFOStatic } from '../engine/ModulationEngine'
import type { ModulationConfig } from '../types/layers'

const CANVAS_W = 200
const CANVAS_H = 48
const LINE_COLOR = '#7b5cff'
const LINE_COLOR_DIM = '#4a3a8a'
const BG_COLOR = 'rgba(0,0,0,0.3)'
const GRID_COLOR = 'rgba(255,255,255,0.06)'

export function ModulationPreview({ mod }: { mod: ModulationConfig }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rafRef = useRef<number>(0)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let startTime = performance.now()

        const draw = () => {
            const now = performance.now()
            const elapsed = (now - startTime) / 1000
            const w = CANVAS_W
            const h = CANVAS_H

            // Background
            ctx.fillStyle = BG_COLOR
            ctx.fillRect(0, 0, w, h)

            // Grid lines (center + quarter)
            ctx.strokeStyle = GRID_COLOR
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(0, h / 2)
            ctx.lineTo(w, h / 2)
            ctx.moveTo(0, h / 4)
            ctx.lineTo(w, h / 4)
            ctx.moveTo(0, (h * 3) / 4)
            ctx.lineTo(w, (h * 3) / 4)
            ctx.stroke()

            if (mod.sourceType === 'lfo') {
                // Draw one full cycle of the waveform + moving playhead
                const color = mod.enabled ? LINE_COLOR : LINE_COLOR_DIM

                ctx.strokeStyle = color
                ctx.lineWidth = 1.5
                ctx.beginPath()

                for (let px = 0; px < w; px++) {
                    // Map pixel to one full LFO cycle (0–1)
                    const t = px / w
                    const raw = evaluateLFOStatic(mod.shape, t + mod.phase)
                    // Apply amplitude and offset
                    const val = raw * mod.amplitude + mod.offset
                    // Map -2..+2 to canvas height
                    const y = h / 2 - (val / 2) * (h / 2)
                    if (px === 0) ctx.moveTo(px, y)
                    else ctx.lineTo(px, y)
                }
                ctx.stroke()

                // Animated playhead
                const cyclePos = ((elapsed * mod.frequency) % 1 + 1) % 1
                const px = cyclePos * w
                ctx.strokeStyle = 'rgba(255,255,255,0.4)'
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.moveTo(px, 0)
                ctx.lineTo(px, h)
                ctx.stroke()
            } else {
                // Audio mode: draw band label and a pulsing bar
                const pulse = (Math.sin(elapsed * 3) + 1) / 2
                const barH = mod.enabled ? h * 0.6 * pulse : h * 0.2
                ctx.fillStyle = mod.enabled ? LINE_COLOR : LINE_COLOR_DIM
                ctx.fillRect(w / 2 - 20, h - barH, 40, barH)

                ctx.fillStyle = 'rgba(255,255,255,0.5)'
                ctx.font = '9px monospace'
                ctx.textAlign = 'center'
                ctx.fillText(mod.audioBand.toUpperCase(), w / 2, 14)
            }

            rafRef.current = requestAnimationFrame(draw)
        }

        rafRef.current = requestAnimationFrame(draw)

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [mod.shape, mod.frequency, mod.phase, mod.amplitude, mod.offset, mod.sourceType, mod.audioBand, mod.enabled])

    return (
        <canvas
            ref={canvasRef}
            className="modulation-preview"
            width={CANVAS_W}
            height={CANVAS_H}
        />
    )
}
