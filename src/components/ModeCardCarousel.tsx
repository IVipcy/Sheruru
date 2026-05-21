'use client'

import { useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MODES } from '@/lib/constants'

export default function ModeCardCarousel() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(index, MODES.length - 1))
    const card = el.children[clamped] as HTMLElement | undefined
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      setActiveIndex(clamped)
    }
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || el.children.length === 0) return
    const center = el.scrollLeft + el.clientWidth / 2
    let closest = 0
    let minDist = Infinity
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i] as HTMLElement
      const childCenter = child.offsetLeft + child.offsetWidth / 2
      const dist = Math.abs(center - childCenter)
      if (dist < minDist) {
        minDist = dist
        closest = i
      }
    }
    setActiveIndex(closest)
  }, [])

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto px-[max(1rem,calc(50%-9rem))] pb-2 pt-1 lg:hidden"
      >
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => router.push(`/chat?mode=${mode.id}`)}
            className="group w-[min(100%,18rem)] shrink-0 snap-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-left shadow-sm transition-all active:scale-[0.98] hover:border-[var(--color-accent)] hover:shadow-lg"
          >
            <div className="mb-4 text-4xl">{mode.icon}</div>
            <h3 className="mb-2 text-lg font-semibold group-hover:text-[var(--color-accent)]">{mode.label}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">{mode.description}</p>
            <div
              className={`mt-4 h-1 w-12 rounded-full ${mode.color} opacity-60 transition-all group-hover:w-20 group-hover:opacity-100`}
            />
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-8 lg:hidden">
        <button
          type="button"
          onClick={() => scrollToIndex(activeIndex - 1)}
          disabled={activeIndex === 0}
          className="rounded-full p-2 text-[var(--color-text)] transition-opacity disabled:opacity-25"
          aria-label="前のモード"
        >
          <ChevronLeft size={28} strokeWidth={2.5} />
        </button>
        <div className="flex gap-2">
          {MODES.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === activeIndex ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => scrollToIndex(activeIndex + 1)}
          disabled={activeIndex === MODES.length - 1}
          className="rounded-full p-2 text-[var(--color-text)] transition-opacity disabled:opacity-25"
          aria-label="次のモード"
        >
          <ChevronRight size={28} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
