'use client'

import { useRef, useEffect, useCallback, useState } from 'react'

interface Live2DAvatarProps {
  emotion?: string
  isTalking?: boolean
  className?: string
}

/** 新モデルが Unity に組み込めたら true にしてプレースホルダーを解除 */
const AVATAR_MODEL_READY = false

function AvatarPlaceholder({ className }: { className: string }) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-light)] ${className}`}
    >
      <p className="text-xl font-semibold tracking-wide text-[var(--color-text)]">作成中</p>
      <p className="mt-2 max-w-[14rem] px-4 text-center text-xs leading-relaxed text-[var(--color-text-muted)]">
        アバターはモデリング中です。公開までしばらくお待ちください。
      </p>
    </div>
  )
}

function Live2DUnityEmbed({
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

  useEffect(() => {
    if (isLoaded) {
      sendToUnity('start', false)
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

export default function Live2DAvatar(props: Live2DAvatarProps) {
  if (!AVATAR_MODEL_READY) {
    return <AvatarPlaceholder className={props.className ?? ''} />
  }
  return <Live2DUnityEmbed {...props} />
}
