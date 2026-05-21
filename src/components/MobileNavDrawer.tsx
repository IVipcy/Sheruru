'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { X, LogOut, User } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/constants'

interface MobileNavDrawerProps {
  open: boolean
  onClose: () => void
  displayName?: string
  badgeImage: string
  showSherpa?: boolean
  onLogout: () => void
}

export default function MobileNavDrawer({
  open,
  onClose,
  displayName = 'ユーザー',
  badgeImage,
  showSherpa,
  onLogout,
}: MobileNavDrawerProps) {
  const pathname = usePathname()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="メニューを閉じる"
        onClick={onClose}
      />
      <aside className="absolute left-0 top-0 flex h-full w-[min(280px,85vw)] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--color-text-muted)]">メニュー</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)]"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`mb-1 block rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-surface-light)]'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
          <Link
            href="/account"
            onClick={onClose}
            className={`mb-1 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              pathname === '/account'
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text)] hover:bg-[var(--color-surface-light)]'
            }`}
          >
            <User size={16} />
            アカウント設定
          </Link>
        </nav>

        <div className="border-t border-[var(--color-border)] p-4">
          <div className="mb-3 flex items-center gap-3">
            <Image src={badgeImage} alt="" width={40} height={40} className="h-10 w-10" />
            <div>
              <p className="text-sm font-medium">{displayName}</p>
              {showSherpa && <p className="text-xs text-pink-500">Sherpa</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose()
              onLogout()
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] py-2.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)] hover:text-red-500"
          >
            <LogOut size={16} />
            ログアウト
          </button>
        </div>
      </aside>
    </div>
  )
}
