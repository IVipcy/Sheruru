'use client'

import { useState, useRef, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import Live2DAvatar from '@/components/Live2DAvatar'
import { useAuth } from '@/hooks/useAuth'
import { SUGGESTIONS_BY_MODE, SuggestionNode } from '@/lib/suggestions'
import { APP_NAME, AVATAR_ICON_PATH } from '@/lib/constants'
import Image from 'next/image'
import { Send, ThumbsUp, AlertCircle, Mic, Volume2, VolumeX, ChevronLeft, RotateCcw } from 'lucide-react'

type MessageType = {
  id: string
  serverMsgId?: string
  role: 'user' | 'assistant'
  content: string
  showActions?: boolean
  actionTaken?: 'good' | 'unsolved' | null
}

const MODE_INFO: Record<string, { label: string; color: string }> = {
  qa: { label: 'QAモード', color: 'text-blue-500' },
  consultation: { label: '案件相談', color: 'text-emerald-500' },
  procedure: { label: '社内手続き', color: 'text-amber-500' },
}

function ChatContent() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'qa'
  const modeInfo = MODE_INFO[mode] || MODE_INFO.qa
  const { profile, signOut } = useAuth()

  const [messages, setMessages] = useState<MessageType[]>([
    { id: '1', role: 'assistant', content: 'どんな悩みがあるのかな？\nなんでも答えるよ？', showActions: false, actionTaken: null },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [suggestionPath, setSuggestionPath] = useState<SuggestionNode[][]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [currentEmotion, setCurrentEmotion] = useState('neutral')
  const [isTalking, setIsTalking] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [lastUserMessage, setLastUserMessage] = useState('')
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentTtsObjectUrlRef = useRef<string | null>(null)
  const ttsFetchAbortRef = useRef<AbortController | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const audioUnlockedRef = useRef(false)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [pendingTtsText, setPendingTtsText] = useState<string | null>(null)

  const getUserBadgeIcon = useCallback(() => {
    if (profile?.selected_badge === 'sherpa' && profile?.is_sherpa) {
      return '/badges/sherpa.png'
    }
    const rank = profile?.good_badge_rank || 1
    if (rank >= 3) return '/badges/good-purple.png'
    if (rank >= 2) return '/badges/good-orange.png'
    return '/badges/good-blue.png'
  }, [profile])

  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const unlockAudioPlayback = useCallback(() => {
    if (audioUnlockedRef.current) return
    const probe = new Audio()
    probe.muted = true
    probe
      .play()
      .then(() => {
        probe.pause()
        audioUnlockedRef.current = true
      })
      .catch(() => {
        /* 初回タップで unlock されるまで待つ */
      })
  }, [])

  const disposeTts = useCallback(() => {
    ttsFetchAbortRef.current?.abort()
    ttsFetchAbortRef.current = null
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      try {
        audioRef.current.load()
      } catch {
        /* ignore */
      }
      audioRef.current = null
    }
    if (currentTtsObjectUrlRef.current) {
      URL.revokeObjectURL(currentTtsObjectUrlRef.current)
      currentTtsObjectUrlRef.current = null
    }
  }, [])

  // Stop streaming + TTS when leaving the chat page (otherwise audio keeps playing)
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      disposeTts()
    }
  }, [disposeTts])

  // Restore previous conversation on mount
  useEffect(() => {
    if (!profile) return
    const loadHistory = async () => {
      try {
        const res = await fetch(`/api/chat/history?mode=${mode}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.conversationId && data.messages.length > 0) {
          setConversationId(data.conversationId)
          const restored: MessageType[] = data.messages.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            showActions: false,
            actionTaken: null,
          }))
          setMessages(restored)
          setShowSuggestions(true)
        }
      } catch { /* use default greeting */ }
    }
    loadHistory()
  }, [mode, profile])

  const getCurrentSuggestions = (): SuggestionNode[] => {
    const rootSuggestions = SUGGESTIONS_BY_MODE[mode] || []
    if (suggestionPath.length === 0) return rootSuggestions
    return suggestionPath[suggestionPath.length - 1]
  }

  const handleSuggestionClick = (node: SuggestionNode) => {
    if (node.children) {
      // Drill down to children
      setSuggestionPath((prev) => [...prev, node.children!])
    } else {
      // Leaf node = send as question
      sendMessage(node.label)
    }
  }

  const resetSuggestions = () => {
    setSuggestionPath([])
    setShowSuggestions(true)
  }

  const parseMessageContent = (content: string): { text: string; choices: string[] } => {
    const match = content.match(/\[\[(?:選択肢|次の質問):(.+?)\]\]/)
    if (!match) return { text: content, choices: [] }
    const text = content.replace(/\[\[(?:選択肢|次の質問):.+?\]\]/, '').trim()
    const choices = match[1].split('|').map((c) => c.trim())
    return { text, choices }
  }

  const cancelCurrentResponse = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    disposeTts()
    setIsTalking(false)
    setIsPlayingAudio(false)
    setIsTyping(false)
  }, [disposeTts])

  const playTTS = useCallback((text: string): Promise<void> => {
    disposeTts()
    setTtsError(null)
    const ac = new AbortController()
    ttsFetchAbortRef.current = ac
    const signal = ac.signal

    const finish = () => {
      if (ttsFetchAbortRef.current === ac) {
        ttsFetchAbortRef.current = null
      }
    }

    return new Promise(async (resolve) => {
      const end = () => {
        finish()
        resolve()
      }

      try {
        let ttsText = text
        if (text.length > 2000) {
          const cutoff = text.slice(0, 2000).lastIndexOf('。')
          ttsText = cutoff > 100 ? text.slice(0, cutoff + 1) : text.slice(0, 2000)
        }

        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: ttsText }),
          signal,
        })

        if (signal.aborted) {
          end()
          return
        }
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          const msg =
            res.status === 503
              ? '音声は未設定です（Render の ELEVENLABS_API_KEY を確認）'
              : res.status === 404
                ? 'ボイスが見つかりません。ElevenLabs で削除済みの Voice ID なら、Render の ELEVENLABS_VOICE_ID を空にするか新しい ID に差し替えてください'
                : '音声の生成に失敗しました'
          setTtsError((errBody as { error?: string }).error || msg)
          end()
          return
        }

        const audioBlob = await res.blob()
        if (signal.aborted) {
          end()
          return
        }

        const audioUrl = URL.createObjectURL(audioBlob)
        currentTtsObjectUrlRef.current = audioUrl

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onplay = () => {
          if (signal.aborted) return
          setTtsError(null)
          setPendingTtsText(null)
          setIsTalking(true)
          setIsPlayingAudio(true)
          setCurrentEmotion('neutraltalking')
        }

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          if (currentTtsObjectUrlRef.current === audioUrl) {
            currentTtsObjectUrlRef.current = null
          }
          if (!signal.aborted) {
            setIsTalking(false)
            setIsPlayingAudio(false)
            setCurrentEmotion('neutral')
          }
          end()
        }

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl)
          if (currentTtsObjectUrlRef.current === audioUrl) {
            currentTtsObjectUrlRef.current = null
          }
          if (!signal.aborted) {
            setIsTalking(false)
            setIsPlayingAudio(false)
            setCurrentEmotion('neutral')
            setTtsError('音声の再生に失敗しました')
          }
          end()
        }

        if (signal.aborted) {
          URL.revokeObjectURL(audioUrl)
          if (currentTtsObjectUrlRef.current === audioUrl) {
            currentTtsObjectUrlRef.current = null
          }
          audioRef.current = null
          end()
          return
        }

        try {
          await audio.play()
        } catch (playErr) {
          if (
            playErr instanceof DOMException &&
            (playErr.name === 'NotAllowedError' || playErr.name === 'AbortError')
          ) {
            setPendingTtsText(text)
            setTtsError('タップして音声を再生')
            end()
            return
          }
          throw playErr
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          disposeTts()
          end()
          return
        }
        disposeTts()
        setIsTalking(false)
        setIsPlayingAudio(false)
        setCurrentEmotion('neutral')
        setTtsError('音声の再生に失敗しました')
        end()
      }
    })
  }, [disposeTts])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return

    unlockAudioPlayback()

    if (isTyping) {
      cancelCurrentResponse()
      await new Promise((r) => setTimeout(r, 50))
    }

    setShowSuggestions(false)
    setLastUserMessage(text)

    const userMsg: MessageType = { id: Date.now().toString(), role: 'user', content: text, showActions: false, actionTaken: null }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    const controller = new AbortController()
    abortControllerRef.current = controller
    const activeConversationId = conversationIdRef.current

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mode, conversationId: activeConversationId }),
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error('API error')
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let aiContent = ''
      let serverMsgId = ''
      let ttsStarted = false
      let ttsPromise: Promise<void> | null = null

      const stripTtsText = (raw: string) =>
        raw.replace(/\[\[(?:選択肢|次の質問):.+?\]\]/g, '').trim()

      const tryStartEarlyTts = (content: string) => {
        if (!audioEnabled || ttsStarted) return
        const ttsContent = stripTtsText(content)
        if (ttsContent.length < 60) return
        const lastPeriod = ttsContent.lastIndexOf('。')
        if (lastPeriod < 20) return
        const early = ttsContent.slice(0, lastPeriod + 1).trim()
        if (early.length < 20) return
        ttsStarted = true
        ttsPromise = playTTS(early)
      }

      const aiMsgId = (Date.now() + 1).toString()
      setMessages((prev) => [...prev, {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        showActions: false,
        actionTaken: null,
      }])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6)
          try {
            const event = JSON.parse(json)
            if (event.type === 'meta') {
              setConversationId(event.conversationId)
            } else if (event.type === 'token') {
              aiContent += event.content
              setMessages((prev) =>
                prev.map((m) => m.id === aiMsgId ? { ...m, content: aiContent } : m)
              )
              tryStartEarlyTts(aiContent)
            } else if (event.type === 'done') {
              serverMsgId = event.messageId
              const isDrillDown = /\[\[選択肢:.+?\]\]/.test(aiContent)
              setMessages((prev) =>
                prev.map((m) => m.id === aiMsgId ? { ...m, showActions: !isDrillDown, serverMsgId } : m)
              )
            }
          } catch { /* skip invalid JSON */ }
        }
      }

      const ttsContent = stripTtsText(aiContent)
      if (audioEnabled && ttsContent) {
        if (!ttsStarted) {
          ttsPromise = playTTS(ttsContent)
        }
        if (ttsPromise) await ttsPromise
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '申し訳ありません、エラーが発生しました。もう一度お試しください。',
        showActions: false,
        actionTaken: null,
      }])
    } finally {
      abortControllerRef.current = null
      setIsTyping(false)
      resetSuggestions()
    }
  }, [isTyping, mode, cancelCurrentResponse, audioEnabled, playTTS, unlockAudioPlayback])

  const toggleRecording = useCallback(() => {
    unlockAudioPlayback()

    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('お使いのブラウザは音声入力に対応していません。Chrome をご利用ください。')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'ja-JP'
    recognition.interimResults = true
    recognition.continuous = false
    recognitionRef.current = recognition

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput(transcript)

      if (event.results[event.results.length - 1].isFinal) {
        setIsRecording(false)
        if (transcript.trim()) {
          sendMessage(transcript.trim())
        }
      }
    }

    recognition.onerror = () => {
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognition.start()
    setIsRecording(true)
  }, [isRecording, sendMessage, unlockAudioPlayback])

  const handleGood = async (msgId: string, serverMsgId?: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionTaken: 'good' } : m))
    )

    if (serverMsgId) {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: serverMsgId, feedbackType: 'good' }),
      })
    }

    disposeTts()
    setIsTalking(false)
    setIsPlayingAudio(false)

    setMessages((prev) => [...prev, {
      id: (Date.now() + 2).toString(),
      role: 'assistant',
      content: '解決したみたいでよかった！\n他にもなんでも聞いてね！',
      showActions: false,
      actionTaken: null,
    }])
    resetSuggestions()
    setCurrentEmotion('happy')
    setTimeout(() => setCurrentEmotion('neutral'), 3000)
  }

  const handleUnsolved = async (msgId: string, aiContent: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionTaken: 'unsolved' } : m))
    )

    disposeTts()
    setIsTalking(false)
    setIsPlayingAudio(false)

    await fetch('/api/unsolved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionText: lastUserMessage,
        aiAnswerText: aiContent,
        mode,
      }),
    })

    setMessages((prev) => [...prev, {
      id: (Date.now() + 3).toString(),
      role: 'assistant',
      content: '未解決ボックスに送信したよ。\n詳しい人が回答してくれるから待っててね！',
      showActions: false,
      actionTaken: null,
    }])
    resetSuggestions()
    setCurrentEmotion('sad')
    setTimeout(() => setCurrentEmotion('neutral'), 3000)
  }

  return (
    <div className="flex h-screen flex-col">
      <Header
        displayName={profile?.display_name}
        badgeRank={profile?.good_badge_rank}
        isSherpa={profile?.is_sherpa}
        selectedBadge={(profile?.selected_badge as 'good' | 'sherpa') || 'good'}
        onLogout={signOut}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Live2D Avatar Area */}
        <div className="hidden w-1/2 flex-shrink-0 flex-col items-center justify-center border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex">
          <Live2DAvatar
            emotion={currentEmotion}
            isTalking={isTalking}
            className="h-[80%] w-full max-w-[500px] rounded-2xl"
          />
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">{APP_NAME}</p>
        </div>

        {/* Chat Area */}
        <div className="flex flex-1 flex-col">
          {/* Mode indicator */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
            <span className={`text-sm font-semibold ${modeInfo.color}`}>● {modeInfo.label}</span>
            <button
              onClick={() => {
                cancelCurrentResponse()
                setMessages([{ id: '1', role: 'assistant', content: 'どんな悩みがあるのかな？\nなんでも答えるよ？', showActions: false, actionTaken: null }])
                setConversationId(null)
                conversationIdRef.current = null
                setTtsError(null)
                setPendingTtsText(null)
                resetSuggestions()
              }}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)]"
              title="新しい会話を始める"
            >
              <RotateCcw size={12} /> 新しい会話
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="mx-auto max-w-2xl space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex items-start gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <Image src={AVATAR_ICON_PATH} alt={APP_NAME} width={32} height={32} className="mt-1 flex-shrink-0 rounded-full object-cover" />
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'border border-[var(--color-border)] bg-[var(--color-surface)]'
                  }`}>
                    <p className="whitespace-pre-line text-sm leading-relaxed">
                      {parseMessageContent(msg.content).text}
                    </p>

                    {/* Inline choice buttons from AI */}
                    {parseMessageContent(msg.content).choices.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
                        {parseMessageContent(msg.content).choices.map((choice) => (
                          <button
                            key={choice}
                            onClick={() => sendMessage(choice)}
                            className="rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
                          >
                            {choice}
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.showActions && !msg.actionTaken && (
                      <div className="mt-3 flex gap-2 border-t border-[var(--color-border)] pt-3">
                        <button
                          onClick={() => handleGood(msg.id, msg.serverMsgId)}
                          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-good)]/15 px-3 py-1.5 text-xs font-medium text-[var(--color-good)] transition-colors hover:bg-[var(--color-good)]/25"
                        >
                          <ThumbsUp size={14} /> Good
                        </button>
                        <button
                          onClick={() => handleUnsolved(msg.id, msg.content)}
                          className="flex items-center gap-1.5 rounded-lg bg-orange-500/15 px-3 py-1.5 text-xs font-medium text-orange-500 transition-colors hover:bg-orange-500/25"
                        >
                          <AlertCircle size={14} /> 未解決BOXへ
                        </button>
                      </div>
                    )}

                    {msg.actionTaken === 'good' && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-[var(--color-good)]">
                        <ThumbsUp size={12} /> Good済み
                      </div>
                    )}
                    {msg.actionTaken === 'unsolved' && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-orange-500">
                        <AlertCircle size={12} /> 未解決BOXに送信済み
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <Image src={getUserBadgeIcon()} alt="badge" width={32} height={32} className="flex-shrink-0 rounded-full" />
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)]" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)]" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)]" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Hierarchical Suggestions */}
          {showSuggestions && (
            <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3">
              <div className="mx-auto max-w-2xl">
                {suggestionPath.length > 0 && (
                  <button
                    onClick={() => setSuggestionPath((prev) => prev.slice(0, -1))}
                    className="mb-2 flex items-center gap-1 text-[10px] text-[var(--color-accent)] hover:underline"
                  >
                    <ChevronLeft size={12} /> 戻る
                  </button>
                )}
                <div className="flex flex-wrap gap-2">
                  {getCurrentSuggestions().map((node) => (
                    <button
                      key={node.label}
                      onClick={() => handleSuggestionClick(node)}
                      className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
                        node.children
                          ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15'
                          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                      }`}
                    >
                      {node.label} {node.children ? ' ▸' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {ttsError && (
            <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-2">
              <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
                <p className="text-xs text-orange-600">{ttsError}</p>
                {pendingTtsText && audioEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      unlockAudioPlayback()
                      void playTTS(pendingTtsText)
                    }}
                    className="shrink-0 rounded-lg bg-[var(--color-accent)] px-3 py-1 text-xs text-white"
                  >
                    再生する
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
            <div className="mx-auto flex max-w-2xl items-center gap-3">
              <button
                onClick={toggleRecording}
                className={`rounded-lg p-2 transition-colors ${
                  isRecording
                    ? 'animate-pulse bg-red-500/15 text-red-500'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)]'
                }`}
                title={isRecording ? '録音中...クリックで停止' : '音声入力'}
              >
                <Mic size={18} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
                placeholder="質問を入力..."
              />
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)]"
              >
                {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="rounded-xl bg-[var(--color-accent)] p-2.5 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p>読み込み中...</p></div>}>
      <ChatContent />
    </Suspense>
  )
}
