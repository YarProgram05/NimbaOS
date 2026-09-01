'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface WbArticleLinkProps {
  nmId: number
  photoUrl?: string | null
}

const IMG_SIZE = 160
const GAP = 8

export function WbArticleLink({ nmId, photoUrl }: WbArticleLinkProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const href = `https://www.wildberries.ru/catalog/${nmId}/detail.aspx`

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleMouseEnter() {
    if (!photoUrl || !linkRef.current) return
    const rect = linkRef.current.getBoundingClientRect()
    const y =
      rect.top - IMG_SIZE - GAP < 0
        ? rect.bottom + GAP
        : rect.top - IMG_SIZE - GAP
    const x = Math.min(
      Math.max(GAP, rect.left),
      Math.max(GAP, window.innerWidth - IMG_SIZE - GAP),
    )
    setPos({ x, y })
  }

  function handleMouseLeave() {
    setPos(null)
  }

  return (
    <>
      <a
        ref={linkRef}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 text-blue-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
      >
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-8 w-8 rounded border object-cover md:hidden" />
        )}
        <span>{nmId}</span>
      </a>

      {mounted && photoUrl && pos &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y,
              zIndex: 9999,
              pointerEvents: 'none',
            }}
            className="rounded-lg overflow-hidden shadow-2xl border border-border bg-background"
          >
            <img
              src={photoUrl}
              alt={`Товар ${nmId}`}
              style={{ width: IMG_SIZE, height: IMG_SIZE, objectFit: 'cover', display: 'block' }}
            />
          </div>,
          document.body,
        )}
    </>
  )
}
