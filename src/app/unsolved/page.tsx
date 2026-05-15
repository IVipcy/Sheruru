'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { MessageSquare, Clock, CheckCircle } from 'lucide-react'
import type { UnsolvedQuestion } from '@/types/database'

const STATUS_TABS = [
  { value: 'open', label: '未解決', icon: <Clock size={14} /> },
  { value: 'answered', label: '回答あり', icon: <MessageSquare size={14} /> },
  { value: 'resolved', label: '解決済み', icon: <CheckCircle size={14} /> },
]

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  qa: { label: 'QA', color: 'bg-blue-100 text-blue-700' },
  consultation: { label: '案件相談', color: 'bg-emerald-100 text-emerald-700' },
  procedure: { label: '手続き', color: 'bg-amber-100 text-amber-700' },
}

export default function UnsolvedListPage() {
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const [questions, setQuestions] = useState<UnsolvedQuestion[]>([])
  const [status, setStatus] = useState('open')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/unsolved?status=${status}`)
      .then((res) => res.json())
      .then((d) => { setQuestions(d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status])

  return (
    <div className="min-h-screen">
      <Header
        displayName={profile?.display_name}
        badgeRank={profile?.good_badge_rank}
        isSherpa={profile?.is_sherpa}
        selectedBadge={(profile?.selected_badge as 'good' | 'sherpa') || 'good'}
        onLogout={signOut}
      />

      <main className="mx-auto max-w-4xl px-4 py-6">
        <h2 className="mb-6 text-xl font-bold">未解決BOX</h2>

        {/* Status Tabs */}
        <div className="mb-6 flex gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                status === tab.value
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)]'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Question List */}
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-[var(--color-text-muted)]">読み込み中...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <p className="text-[var(--color-text-muted)]">質問はありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => {
              const modeInfo = MODE_LABELS[q.mode] || MODE_LABELS.qa
              return (
                <div
                  key={q.id}
                  onClick={() => router.push(`/unsolved/${q.id}`)}
                  className="block cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-shadow hover:shadow-md"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${modeInfo.color}`}>
                      {modeInfo.label}
                    </span>
                    {q.category && (
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                        {typeof q.category === 'object' ? q.category.name : q.category}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                      {new Date(q.created_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <p className="mb-2 text-sm font-medium leading-relaxed">{q.question_text}</p>
                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                    <span>{q.author?.display_name || '匿名'}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare size={12} />
                      {Array.isArray(q.answers_count) ? q.answers_count[0]?.count ?? 0 : (typeof q.answers_count === 'object' && q.answers_count !== null ? (q.answers_count as unknown as {count: number}).count : q.answers_count ?? 0)}件の回答
                    </span>
                    <span>共感 {q.empathy_count}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
