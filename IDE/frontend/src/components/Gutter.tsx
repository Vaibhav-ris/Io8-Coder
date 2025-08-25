import { useEffect, useRef } from 'react'

export type Direction = 'vertical' | 'horizontal'

export function Gutter({ direction, onDrag, onEnd, className }: { direction: Direction; onDrag: (clientPos: number) => void; onEnd?: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault()
      (e.target as Element).setPointerCapture?.(e.pointerId)
      const move = (ev: PointerEvent) => {
        if (direction === 'vertical') onDrag(ev.clientX)
        else onDrag(ev.clientY)
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        onEnd?.()
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }

    el.addEventListener('pointerdown', onPointerDown)
    return () => el.removeEventListener('pointerdown', onPointerDown)
  }, [direction, onDrag, onEnd])

  const base = direction === 'vertical' ? 'cursor-col-resize self-stretch' : 'cursor-row-resize w-full'
  const sizeStyle = direction === 'vertical' ? { width: '6px' } : { height: '6px' }

  return <div ref={ref} className={`${base} ${className || ''}`} style={{ background: 'var(--gutter)', ...sizeStyle }} />
}
