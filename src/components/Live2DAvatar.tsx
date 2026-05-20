'use client'

import { useRef, useEffect, useCallback, useState } from 'react'

interface Live2DAvatarProps {
  emotion?: string
  isTalking?: boolean
  className?: string
}

export default function Live2DAvatar({
  emotion = 'neutral',
  isTalking = false,
  className = '',
}: Live2DAvatarProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  const sendToUnity = useCallback((emotionValue: string, talking: boolean) => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return

    const payload = { type: 'emotion', emotion: emotionValue, talking }
    iframe.contentWindow.postMessage(payload, '*')
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    const emotionToSend = isTalking ? 'neutraltalking' : emotion
    sendToUnity(emotionToSend, isTalking)
  }, [emotion, isTalking, isLoaded, sendToUnity])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = event.data
        if (data?.type === 'unity-ready') {
          setIsLoaded(true)
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener('message', handleMessage)

    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, 8000)

    return () => {
      window.removeEventListener('message', handleMessage)
      clearTimeout(timer)
    }
  }, [])

  // Live2D の初期化完了は unity-ready より遅れることがあるため、neutral を繰り返し送る
  useEffect(() => {
    if (!isLoaded) return

    const applyIdleNeutral = () => sendToUnity('neutral', false)
    const applyStart = () => sendToUnity('start', false)

    applyStart()
    applyIdleNeutral()

    const retries = [800, 2000, 4000, 7000, 11000].map((ms) =>
      window.setTimeout(applyIdleNeutral, ms)
    )
    const startAgain = window.setTimeout(applyStart, 3000)

    return () => {
      retries.forEach((id) => window.clearTimeout(id))
      window.clearTimeout(startAgain)
    }
  }, [isLoaded, sendToUnity])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <iframe
        ref={iframeRef}
        src="/unity/index.html"
        className="h-full w-full border-0"
        allow="autoplay"
        title="Live2D Avatar"
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface)]">
          <div className="text-center">
            <div className="mx-auto mb-3 h-16 w-16 animate-pulse rounded-full bg-[var(--color-accent)]/20" />
            <p className="text-xs text-[var(--color-text-muted)]">アバター読み込み中...</p>
          </div>
        </div>
      )}
    </div>
  )
}
