'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, LogOut, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { APP_NAME, APP_LOGO_PATH, NAV_ITEMS } from '@/lib/constants'
import MobileNavDrawer from '@/components/MobileNavDrawer'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import type { Notification } from '@/types/database'

const BADGE_IMAGES: Record<number, string> = {
  1: '/badges/good-blue.png',
  2: '/badges/good-orange.png',
  3: '/badges/good-purple.png',
}

interface HeaderProps {
  displayName?: string
  badgeRank?: number
  isSherpa?: boolean
  selectedBadge?: 'good' | 'sherpa'
  onLogout?: () => void
}

function formatNotifTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function Header({
  displayName = 'ユーザー',
  badgeRank = 1,
  isSherpa = false,
  selectedBadge = 'good',
  onLogout,
}: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { notifications, unreadCount, markAsRead, refetch } = useNotifications(user?.id)
  const [showNotif, setShowNotif] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (showNotif && user?.id) {
      void refetch()
    }
  }, [showNotif, user?.id, refetch])

  const handleLogout = async () => {
    if (onLogout) {
      onLogout()
      return
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleNotifClick = async (n: Notification) => {
    if (!n.is_read) {
      await markAsRead([n.id])
    }
    setShowNotif(false)
    if (n.link) {
      router.push(n.link)
    }
  }

  const showSherpa = selectedBadge === 'sherpa' && isSherpa
  const badgeImage = showSherpa ? '/badges/sherpa.png' : (BADGE_IMAGES[badgeRank] || BADGE_IMAGES[1])

  return (
    <>
      <header className="z-50 flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-sm">
        <div className="flex h-14 w-full items-center gap-2 pl-2 pr-3 sm:gap-4 sm:pl-4 sm:pr-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)] lg:hidden"
            aria-label="メニューを開く"
          >
            <Menu size={22} />
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2" onClick={() => setMenuOpen(false)}>
            <Image
              src={APP_LOGO_PATH}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
            <span className="text-lg font-bold tracking-wider text-[var(--color-accent)] sm:text-xl">
              {APP_NAME}
            </span>
          </Link>

          <nav className="ml-6 hidden gap-1 lg:flex lg:ml-20 xl:ml-28">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotif((v) => !v)}
                className="relative rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)]"
                aria-label="通知"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotif && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-[60] cursor-default"
                    aria-label="通知を閉じる"
                    onClick={() => setShowNotif(false)}
                  />
                  <div className="absolute right-0 z-[70] mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
                    <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
                      <p className="text-xs font-semibold text-[var(--color-text-muted)]">通知</p>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void markAsRead()}
                          className="text-[10px] text-[var(--color-accent)] hover:underline"
                        >
                          すべて既読
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-[var(--color-text-muted)]">
                          新しい通知はありません
                        </p>
                      ) : (
                        <ul className="divide-y divide-[var(--color-border)]">
                          {notifications.map((n) => (
                            <li key={n.id}>
                              <button
                                type="button"
                                onClick={() => void handleNotifClick(n)}
                                className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-light)] ${
                                  !n.is_read ? 'bg-[var(--color-accent)]/5' : ''
                                }`}
                              >
                                <p className="text-sm font-medium leading-snug">{n.title}</p>
                                {n.body ? (
                                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)] line-clamp-2">
                                    {n.body}
                                  </p>
                                ) : null}
                                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                                  {formatNotifTime(n.created_at)}
                                </p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => router.push('/account')}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-light)] sm:px-3"
            >
              <Image src={badgeImage} alt="badge" width={32} height={32} className="h-8 w-8" />
              <div className="hidden text-left sm:block">
                <p className="text-xs font-medium leading-tight">{displayName}</p>
                {showSherpa && <p className="text-[10px] leading-tight text-pink-500">Sherpa</p>}
              </div>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="ログアウト"
              className="hidden rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-light)] hover:text-red-400 lg:block"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <MobileNavDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        displayName={displayName}
        badgeImage={badgeImage}
        showSherpa={showSherpa}
        onLogout={handleLogout}
      />
    </>
  )
}
