'use client'

import { useState } from 'react'
import Image from 'next/image'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { getBadgeInfo } from '@/types/database'
import { Save, Check } from 'lucide-react'

const BADGE_LEVELS: { rank: number | 'sherpa'; label: string; requirement: string; image: string; color: string }[] = [
  { rank: 1, label: 'Trekker', requirement: 'Good 10回未満', image: '/badges/good-blue.png', color: 'border-blue-400' },
  { rank: 2, label: 'Climber', requirement: 'Good 10回以上', image: '/badges/good-orange.png', color: 'border-orange-400' },
  { rank: 3, label: 'Summiteer', requirement: 'Good 30回以上', image: '/badges/good-purple.png', color: 'border-purple-400' },
  { rank: 'sherpa', label: 'Sherpa', requirement: '未解決BOX 3回以上回答', image: '/badges/sherpa.png', color: 'border-pink-400' },
]

export default function AccountPage() {
  const { profile, refetchProfile, signOut } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [department, setDepartment] = useState('')
  const [selectedBadge, setSelectedBadge] = useState<'good' | 'sherpa'>('good')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Initialize form from profile
  if (profile && !initialized) {
    setDisplayName(profile.display_name || '')
    setDepartment(profile.department || '')
    setSelectedBadge((profile.selected_badge as 'good' | 'sherpa') || 'good')
    setInitialized(true)
  }

  const currentBadge = profile
    ? getBadgeInfo(profile.total_good_count, profile.is_sherpa, selectedBadge)
    : null

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName, department, selected_badge: selectedBadge }),
    })
    await refetchProfile()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSelectBadge = (badge: 'good' | 'sherpa') => {
    if (badge === 'sherpa' && !profile?.is_sherpa) return
    setSelectedBadge(badge)
  }

  if (!profile) {
    return (
      <div className="min-h-screen">
        <Header onLogout={signOut} />
        <div className="flex h-64 items-center justify-center">
          <p className="text-[var(--color-text-muted)]">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header
        displayName={profile.display_name}
        badgeRank={profile.good_badge_rank}
        isSherpa={profile.is_sherpa}
        selectedBadge={selectedBadge}
        onLogout={signOut}
      />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="mb-6 text-xl font-bold">アカウント設定</h2>

        <div className="space-y-6">
          {/* Profile Info */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h3 className="mb-4 text-sm font-semibold">プロフィール</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-muted)]">表示名</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-muted)]">部署</label>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
                  placeholder="営業部"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h3 className="mb-4 text-sm font-semibold">実績</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatBox label="会話数" value={profile.total_conversations} />
              <StatBox label="Good数" value={profile.total_good_count} />
              <StatBox label="Bad数" value={profile.total_bad_count} />
              <StatBox label="Sherpa回答" value={profile.sherpa_solve_count} />
            </div>
          </div>

          {/* Badge Selection */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h3 className="mb-2 text-sm font-semibold">バッジ選択</h3>
            <p className="mb-4 text-xs text-[var(--color-text-muted)]">表示するバッジを選択できます（獲得済みのみ）</p>

            {currentBadge && (
              <div className="mb-6 flex items-center gap-3 rounded-lg bg-[var(--color-bg)] p-4">
                <Image src={currentBadge.image} alt={currentBadge.label} width={48} height={48} />
                <div>
                  <p className="text-sm font-semibold">{currentBadge.label}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">現在表示中のバッジ</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {BADGE_LEVELS.map((badge) => {
                const isGoodBadge = typeof badge.rank === 'number'
                const isEarned = isGoodBadge
                  ? profile.good_badge_rank >= (badge.rank as number)
                  : profile.is_sherpa
                const isSelected = isGoodBadge
                  ? selectedBadge === 'good' && profile.good_badge_rank === (badge.rank as number)
                  : selectedBadge === 'sherpa'

                return (
                  <button
                    key={badge.label}
                    onClick={() => handleSelectBadge(isGoodBadge ? 'good' : 'sherpa')}
                    disabled={!isEarned}
                    className={`relative rounded-xl border-2 p-4 text-center transition-all ${
                      isSelected
                        ? `${badge.color} bg-[var(--color-bg)]`
                        : isEarned
                        ? 'border-[var(--color-border)] hover:border-[var(--color-accent)]'
                        : 'border-[var(--color-border)] opacity-40'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 rounded-full bg-[var(--color-accent)] p-0.5">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                    <Image
                      src={badge.image}
                      alt={badge.label}
                      width={40}
                      height={40}
                      className={`mx-auto ${!isEarned ? 'grayscale' : ''}`}
                    />
                    <p className="mt-2 text-xs font-medium">{badge.label}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{badge.requirement}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saved ? <><Check size={16} /> 保存しました</> : <><Save size={16} /> {saving ? '保存中...' : '変更を保存'}</>}
          </button>
        </div>
      </main>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[var(--color-bg)] p-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
    </div>
  )
}
