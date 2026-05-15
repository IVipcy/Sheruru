'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { Send, CheckCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

/** DB や経路によって is_accepted が boolean 以外で返ることがあるため、採用済みだけ true とみなす */
function isAnswerMarkedAccepted(isAccepted: unknown): boolean {
  if (isAccepted === true || isAccepted === 1) return true
  if (typeof isAccepted === 'string') {
    const s = isAccepted.trim().toLowerCase()
    return s === 'true' || s === 't' || s === '1' || s === 'yes'
  }
  return false
}

interface QuestionDetail {
  id: string
  user_id: string
  question_text: string
  ai_answer_text: string | null
  mode: string
  status: string
  empathy_count: number
  created_at: string
  author?: { display_name: string; department: string } | null
  /** サーバーが Cookie のセッションと question.user_id を照合して返す */
  can_accept_best?: boolean
}

interface Answer {
  id: string
  answer_text: string
  is_accepted: boolean
  created_at: string
  answerer?: { display_name: string; department: string } | null
}

export default function UnsolvedDetailPage() {
  const params = useParams()
  const questionId = typeof params.id === 'string' ? params.id : ''
  const { profile, signOut } = useAuth()

  const [question, setQuestion] = useState<QuestionDetail | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [newAnswer, setNewAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (!questionId) return

    fetch(`/api/unsolved/${questionId}`)
      .then((res) => res.json())
      .then((data) => {
        setQuestion(data.question || null)
        setAnswers(data.answers || [])
      })
      .catch((err) => console.error('Fetch error:', err))
      .finally(() => setLoading(false))
  }, [questionId])

  const handleSubmitAnswer = async () => {
    if (!newAnswer.trim() || submitting) return
    setSubmitting(true)
    setActionError('')

    const res = await fetch(`/api/unsolved/${questionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerText: newAnswer }),
    })

    if (res.ok) {
      const { data } = await res.json()
      setAnswers((prev) => [...prev, {
        ...data,
        answerer: { display_name: profile?.display_name || '', department: profile?.department || '' },
      }])
      setNewAnswer('')
      if (question) setQuestion({ ...question, status: 'answered' })
    } else {
      const err = await res.json().catch(() => ({}))
      setActionError(typeof err.error === 'string' ? err.error : '回答の送信に失敗しました')
    }
    setSubmitting(false)
  }

  const handleAcceptAnswer = async (answerId: string) => {
    setActionError('')
    const res = await fetch(`/api/unsolved/${questionId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerId }),
    })

    if (res.ok) {
      setAnswers((prev) => prev.map((a) => a.id === answerId ? { ...a, is_accepted: true } : a))
      if (question) setQuestion({ ...question, status: 'resolved' })
    } else {
      const err = await res.json().catch(() => ({}))
      setActionError(typeof err.error === 'string' ? err.error : 'ベストアンサーの登録に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header displayName={profile?.display_name} onLogout={signOut} />
        <div className="flex h-64 items-center justify-center">
          <p className="text-[var(--color-text-muted)]">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="min-h-screen">
        <Header displayName={profile?.display_name} onLogout={signOut} />
        <div className="flex h-64 items-center justify-center">
          <p className="text-[var(--color-text-muted)]">質問が見つかりませんでした</p>
        </div>
      </div>
    )
  }

  const canPickBest = question.can_accept_best === true

  return (
    <div className="min-h-screen">
      <Header
        displayName={profile?.display_name}
        badgeRank={profile?.good_badge_rank}
        isSherpa={profile?.is_sherpa}
        selectedBadge={(profile?.selected_badge as 'good' | 'sherpa') || 'good'}
        onLogout={signOut}
      />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/unsolved" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline">
          <ArrowLeft size={14} /> 一覧に戻る
        </Link>

        {actionError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {actionError}
          </div>
        )}

        {/* Question */}
        <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
              question.status === 'resolved' ? 'bg-green-100 text-green-700' : question.status === 'answered' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {question.status === 'resolved' ? '解決済み' : question.status === 'answered' ? '回答あり' : '未解決'}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">{new Date(question.created_at).toLocaleDateString('ja-JP')}</span>
          </div>

          <h2 className="mb-3 text-base font-semibold leading-relaxed">{question.question_text}</h2>

          {question.ai_answer_text && (
            <div className="rounded-lg bg-[var(--color-bg)] p-4">
              <p className="mb-1 text-[10px] font-medium text-[var(--color-text-muted)]">AI回答（未解決）</p>
              <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{question.ai_answer_text}</p>
            </div>
          )}

          <div className="mt-3 text-xs text-[var(--color-text-muted)]">
            投稿者: {question.author?.display_name || '匿名'} ({question.author?.department || '-'})
          </div>
        </div>

        {/* Answers */}
        <div className="mb-6 space-y-4">
          <h3 className="text-sm font-semibold">回答 ({answers.length})</h3>
          {!canPickBest && question.status !== 'resolved' && answers.length > 0 && (
            <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
              ベストアンサーに選べるのは、この質問を投稿したユーザーのみです。
            </p>
          )}
          {answers.length === 0 ? (
            <p className="rounded-lg bg-[var(--color-bg)] p-4 text-center text-sm text-[var(--color-text-muted)]">まだ回答がありません</p>
          ) : (
            answers.map((ans) => {
              const accepted = isAnswerMarkedAccepted(ans.is_accepted)
              return (
              <div key={ans.id} className={`rounded-xl border p-5 ${accepted ? 'border-green-300 bg-green-50' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
                {accepted && (
                  <div className="mb-2 flex items-center gap-1 text-xs font-medium text-green-600">
                    <CheckCircle size={14} /> ベストアンサー
                  </div>
                )}
                <p className="mb-3 whitespace-pre-line text-sm leading-relaxed">{ans.answer_text}</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 text-xs text-[var(--color-text-muted)]">
                    {ans.answerer?.display_name || '匿名'} · {new Date(ans.created_at).toLocaleDateString('ja-JP')}
                  </span>
                  {canPickBest && !accepted && question.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => handleAcceptAnswer(ans.id)}
                      className="shrink-0 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600"
                    >
                      ベストアンサーに選ぶ
                    </button>
                  )}
                </div>
              </div>
              )
            })
          )}
        </div>

        {/* Answer Form */}
        {question.status !== 'resolved' && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h3 className="mb-3 text-sm font-semibold">回答する</h3>
            <textarea
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              className="mb-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--color-accent)]"
              rows={4}
              placeholder="回答を入力してください..."
            />
            <button
              onClick={handleSubmitAnswer}
              disabled={!newAnswer.trim() || submitting}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send size={14} /> {submitting ? '送信中...' : '回答を送信'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
