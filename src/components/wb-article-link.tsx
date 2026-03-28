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
    setPos({ x: rect.left, y })
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
        className="text-blue-500 hover:underline"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {nmId}
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
