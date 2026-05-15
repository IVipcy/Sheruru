'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

// Supabaseはemail形式が必須なので、社員IDを内部的にダミーメールに変換
const toInternalEmail = (employeeId: string) => `${employeeId}@gyaosuu.internal`

const adminContactEmail = process.env.NEXT_PUBLIC_ADMIN_CONTACT_EMAIL?.trim() || ''

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const email = toInternalEmail(employeeId)

    try {
      if (isSignUp) {
        if (!displayName.trim()) {
          throw new Error('表示名を入力してください')
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName, employee_id: employeeId } },
        })
        if (signUpError) throw signUpError

        // Sign in immediately after signup
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          if (signInError.message === 'Invalid login credentials') {
            throw new Error('社員IDまたはパスワードが正しくありません')
          }
          throw signInError
        }
      }
      // Ensure session is stored before navigating
      await supabase.auth.getSession()
      window.location.href = '/'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-wider text-[var(--color-accent)]">GYAOSUU</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">営業力強化AIアバター</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">表示名</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
                placeholder="山田 太郎"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">社員ID</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
              placeholder="例: ML12345"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--color-accent)] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? '処理中...' : isSignUp ? 'アカウント作成' : 'ログイン'}
          </button>
        </form>

        <div className="mt-6 space-y-4 text-center">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setShowForgotPassword(false) }}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            {isSignUp ? 'アカウントをお持ちの方はこちら' : '初回利用の方はこちら（アカウント作成）'}
          </button>

          {!isSignUp && (
            <div>
              <button
                type="button"
                onClick={() => { setShowForgotPassword((v) => !v); setError('') }}
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:underline"
              >
                パスワードをお忘れの方はこちら
              </button>

              {showForgotPassword && (
                <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-left text-sm leading-relaxed text-[var(--color-text)]">
                  <p className="mb-3 text-[var(--color-text-muted)]">
                    パスワードの再設定は管理者が手動で行います。下記アドレス宛に、<strong className="text-[var(--color-text)]">社員ID</strong>
                    を本文に必ずご記載のうえ、メールでご連絡ください。
                  </p>
                  {adminContactEmail ? (
                    <p>
                      <span className="text-xs text-[var(--color-text-muted)]">連絡先（管理者）</span>
                      <br />
                      <a
                        href={`mailto:${adminContactEmail}?subject=${encodeURIComponent('GYAOSUU パスワード再設定の依頼')}&body=${encodeURIComponent('社員ID: \n')}`}
                        className="break-all font-medium text-[var(--color-accent)] hover:underline"
                      >
                        {adminContactEmail}
                      </a>
                    </p>
                  ) : (
                    <p className="text-xs text-amber-800">
                      連絡先メールが未設定です。環境変数{' '}
                      <code className="rounded bg-[var(--color-surface)] px-1">NEXT_PUBLIC_ADMIN_CONTACT_EMAIL</code>{' '}
                      に管理者メールを設定してください。
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
