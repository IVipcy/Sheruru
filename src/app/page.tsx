'use client'

import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import ModeCardCarousel from '@/components/ModeCardCarousel'
import { useAuth } from '@/hooks/useAuth'
import { MODES } from '@/lib/constants'

export default function HomePage() {
  const router = useRouter()
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen">
      <Header
        displayName={profile?.display_name}
        badgeRank={profile?.good_badge_rank}
        isSherpa={profile?.is_sherpa}
        selectedBadge={(profile?.selected_badge as 'good' | 'sherpa') || 'good'}
        onLogout={signOut}
      />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <div className="mb-8 text-center sm:mb-10">
          <h2 className="text-xl font-bold sm:text-2xl">モードを選択してください</h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            目的に応じたモードでAIアバターがサポートします
          </p>
        </div>

        <ModeCardCarousel />

        <div className="mt-8 hidden grid-cols-1 gap-6 sm:grid-cols-3 lg:grid">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => router.push(`/chat?mode=${mode.id}`)}
              className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-left transition-all hover:border-[var(--color-accent)] hover:shadow-lg"
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
      </main>
    </div>
  )
}
