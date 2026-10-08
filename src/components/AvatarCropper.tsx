'use client'
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react'

// Square crop for profile pictures: drag to move, pinch / wheel / slider to zoom, inside a round
// preview. Exports a 512×512 JPEG (small, always under the 2 MB upload limit).

const VIEW = 280 // on-screen crop circle (px)
const OUT = 512 // exported size (px)
const MAX_ZOOM = 4

type Props = { src: string; onCancel: () => void; onDone: (file: File, previewUrl: string) => void }

export default function AvatarCropper({ src, onCancel, onDone }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 }) // image top-left inside the circle
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const pinch = useRef<{ d: number; zoom: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const [busy, setBusy] = useState(false)

  const base = img ? Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) : 1
  const scale = base * zoom

  const clamp = useCallback(
    (p: { x: number; y: number }, s = scale) => {
      if (!img) return p
      const w = img.naturalWidth * s
      const h = img.naturalHeight * s
      return { x: Math.min(0, Math.max(VIEW - w, p.x)), y: Math.min(0, Math.max(VIEW - h, p.y)) }
    },
    [img, scale],
  )

  useEffect(() => {
    const el = new Image()
    el.onload = () => {
      setImg(el)
      const s = Math.max(VIEW / el.naturalWidth, VIEW / el.naturalHeight)
      // Start centred horizontally and a little towards the top — faces usually sit there.
      setPos({ x: (VIEW - el.naturalWidth * s) / 2, y: Math.min(0, (VIEW - el.naturalHeight * s) * 0.3) })
      setZoom(1)
    }
    el.src = src
  }, [src])

  /** Zoom around the centre of the circle so the face stays where it is. */
  const setZoomAround = (next: number, cx = VIEW / 2, cy = VIEW / 2) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, next))
    const s2 = base * z
    const ratio = s2 / scale
    setPos(clamp({ x: cx - (cx - pos.x) * ratio, y: cy - (cy - pos.y) * ratio }, s2))
    setZoom(z)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom }
      drag.current = null
    } else {
      drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      setZoomAround(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d))
    } else if (drag.current) {
      setPos(clamp({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }))
    }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 30 : 10
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[e.key]) {
      e.preventDefault()
      setPos(clamp({ x: pos.x + moves[e.key][0], y: pos.y + moves[e.key][1] }))
    } else if (e.key === '+' || e.key === '=') setZoomAround(zoom + 0.1)
    else if (e.key === '-') setZoomAround(zoom - 0.1)
    else if (e.key === 'Escape') onCancel()
  }

  const confirm = async () => {
    if (!img) return
    setBusy(true)
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, OUT, OUT)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, -pos.x / scale, -pos.y / scale, VIEW / scale, VIEW / scale, 0, 0, OUT, OUT)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
    setBusy(false)
    if (!blob) return
    onDone(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }), URL.createObjectURL(blob))
  }

  return (
    <div className="cropper-backdrop" role="dialog" aria-modal="true" aria-label="จัดตำแหน่งรูปโปรไฟล์" onKeyDown={onKey}>
      <div className="cropper-panel">
        <b style={{ fontSize: 18 }}>จัดตำแหน่งรูปโปรไฟล์</b>
        <span className="muted" style={{ fontSize: 13 }}>ลากเพื่อเลื่อน · ถ่างนิ้ว / เลื่อนล้อเมาส์ / แถบด้านล่างเพื่อซูม</span>
        <div
          className="cropper-view"
          style={{ width: VIEW, height: VIEW }}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => setZoomAround(zoom - e.deltaY * 0.002)}
        >
          {img && (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{ position: 'absolute', left: pos.x, top: pos.y, width: img.naturalWidth * scale, height: img.naturalHeight * scale, maxWidth: 'none', userSelect: 'none', pointerEvents: 'none' }}
            />
          )}
          <span className="cropper-ring" aria-hidden="true" />
        </div>
        <label className="row" style={{ gap: 10, width: VIEW, fontSize: 13 }}>
          <span aria-hidden="true">－</span>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => setZoomAround(Number(e.target.value))} aria-label="ซูม" style={{ flex: 1 }} />
          <span aria-hidden="true">＋</span>
        </label>
        <div className="row" style={{ gap: 10, justifyContent: 'flex-end', width: '100%' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
            ยกเลิก
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={confirm} disabled={!img || busy}>
            {busy ? 'กำลังเตรียมรูป…' : 'ใช้รูปนี้'}
          </button>
        </div>
      </div>
    </div>
  )
}
