'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { MessageSquare, CalendarDays, AlertCircle, CheckCircle, ThumbsUp, Trophy, TrendingUp } from 'lucide-react'

interface DashboardData {
  profile: {
    total_conversations: number
    total_good_count: number
    total_bad_count: number
    sherpa_solve_count: number
  } | null
  monthlyQuestions: number
  unsolvedOpen: number
  unsolvedResolved: number
  recentConversations: { id: string; mode: string; started_at: string; message_count: number }[]
  leaderboard: { id: string; display_name: string; department: string; total_good_count: number; good_badge_rank: number; is_sherpa: boolean }[]
  sherpaLeaderboard: { id: string; display_name: string; department: string; sherpa_solve_count: number; is_sherpa: boolean }[]
  popularTopics: { topic: string; count: number }[]
}

const MODE_LABELS: Record<string, string> = { qa: 'QA', consultation: '案件相談', procedure: '社内手続き' }

export default function DashboardPage() {
  const { profile, signOut } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const stats = data?.profile

  return (
    <div className="min-h-screen">
      <Header
        displayName={profile?.display_name}
        badgeRank={profile?.good_badge_rank}
        isSherpa={profile?.is_sherpa}
        selectedBadge={(profile?.selected_badge as 'good' | 'sherpa') || 'good'}
        onLogout={signOut}
      />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <h2 className="mb-6 text-xl font-bold">ダッシュボード</h2>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-[var(--color-text-muted)]">読み込み中...</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard icon={<MessageSquare size={20} />} label="総会話数" value={stats?.total_conversations || 0} color="text-blue-500" />
              <KpiCard icon={<CalendarDays size={20} />} label="今月の質問数" value={data?.monthlyQuestions || 0} color="text-indigo-500" />
              <KpiCard icon={<AlertCircle size={20} />} label="未解決BOX 未回答" value={data?.unsolvedOpen || 0} color="text-orange-500" />
              <KpiCard icon={<CheckCircle size={20} />} label="未解決BOX 解決済" value={data?.unsolvedResolved || 0} color="text-emerald-500" />
            </div>

            {/* Rankings */}
            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Good Ranking */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <ThumbsUp size={16} className="text-[var(--color-good)]" />
                  <h3 className="text-sm font-semibold">Goodランキング Top10</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)]">
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">名前</th>
                        <th className="px-3 py-2">部署</th>
                        <th className="px-3 py-2">Good数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.leaderboard?.map((user, idx) => (
                        <tr key={user.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-3 py-2 font-semibold">{idx + 1}</td>
                          <td className="px-3 py-2">{user.display_name}</td>
                          <td className="px-3 py-2 text-[var(--color-text-muted)]">{user.department || '-'}</td>
                          <td className="px-3 py-2 font-medium text-[var(--color-good)]">{user.total_good_count}</td>
                        </tr>
                      ))}
                      {(!data?.leaderboard || data.leaderboard.length === 0) && (
                        <tr><td colSpan={4} className="px-3 py-4 text-center text-[var(--color-text-muted)]">まだデータがありません</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sherpa Ranking */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Trophy size={16} className="text-pink-500" />
                  <h3 className="text-sm font-semibold">Sherpa貢献ランキング Top10</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)]">
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">名前</th>
                        <th className="px-3 py-2">部署</th>
                        <th className="px-3 py-2">回答数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.sherpaLeaderboard?.map((user, idx) => (
                        <tr key={user.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-3 py-2 font-semibold">{idx + 1}</td>
                          <td className="px-3 py-2">{user.display_name}</td>
                          <td className="px-3 py-2 text-[var(--color-text-muted)]">{user.department || '-'}</td>
                          <td className="px-3 py-2 font-medium text-pink-500">{user.sherpa_solve_count}</td>
                        </tr>
                      ))}
                      {(!data?.sherpaLeaderboard || data.sherpaLeaderboard.length === 0) && (
                        <tr><td colSpan={4} className="px-3 py-4 text-center text-[var(--color-text-muted)]">まだSherpaはいません</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Popular Topics + Recent Conversations */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Popular Topics */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-blue-500" />
                  <h3 className="text-sm font-semibold">よく聞かれるトピック</h3>
                </div>
                {data?.popularTopics && data.popularTopics.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {data.popularTopics.map((t) => (
                      <span key={t.topic} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        {t.topic}
                        <span className="text-blue-400">({t.count})</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)]">まだデータがありません</p>
                )}
              </div>

              {/* Recent Conversations */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <MessageSquare size={16} className="text-indigo-500" />
                  <h3 className="text-sm font-semibold">最近の質問</h3>
                </div>
                {data?.recentConversations && data.recentConversations.length > 0 ? (
                  <div className="space-y-2">
                    {data.recentConversations.map((conv) => (
                      <div key={conv.id} className="flex items-center justify-between rounded-lg bg-[var(--color-bg)] px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{MODE_LABELS[conv.mode] || conv.mode}</span>
                          <span className="text-xs text-[var(--color-text-muted)]">{conv.message_count}メッセージ</span>
                        </div>
                        <span className="text-xs text-[var(--color-text-muted)]">{new Date(conv.started_at).toLocaleDateString('ja-JP')}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)]">まだ会話がありません</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function KpiCard({ icon, label, value, suffix, color }: { icon: React.ReactNode; label: string; value: number; suffix?: string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <p className="text-2xl font-bold">{value}{suffix}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
    </div>
  )
}
