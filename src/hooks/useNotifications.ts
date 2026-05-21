'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { Notification } from '@/types/database'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
    }
  }, [userId, supabase])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Realtime subscription
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresInsertPayload<Notification>) => {
          const newNotif = payload.new
          setNotifications((prev) => [newNotif, ...prev])
          setUnreadCount((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  const markAsRead = async (ids?: string[]) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setNotifications((prev) => {
      const next = prev.map((n) =>
        ids ? (ids.includes(n.id) ? { ...n, is_read: true } : n) : { ...n, is_read: true }
      )
      setUnreadCount(next.filter((n) => !n.is_read).length)
      return next
    })
  }

  return { notifications, unreadCount, markAsRead, refetch: fetchNotifications }
}
