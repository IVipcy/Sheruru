'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const pathname = usePathname()

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile')
      if (!res.ok) return
      const json = await res.json()
      if (json.data) {
        setProfile(json.data)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        await fetchProfile()
      }
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return
        const authUser = session?.user ?? null
        setUser(authUser)
        if (authUser) {
          await fetchProfile()
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  // Client-side auth guard: redirect to /login if not authenticated
  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      window.location.href = '/login'
    }
  }, [loading, user, pathname])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return { user, profile, loading, signOut, refetchProfile: fetchProfile }
}
