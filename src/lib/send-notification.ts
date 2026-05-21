import { createServiceRoleClient } from '@/lib/supabase-admin'

export type NotificationInsert = {
  user_id: string
  type: 'answer_posted' | 'question_resolved' | 'badge_earned'
  title: string
  body?: string
  link?: string
}

/** RLS では他ユーザーへの insert が不可なため、サービスロールで通知を作成する */
export async function sendNotification(payload: NotificationInsert): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('sendNotification: SUPABASE_SERVICE_ROLE_KEY is not set')
    return false
  }

  try {
    const admin = createServiceRoleClient()
    const { error } = await admin.from('notifications').insert({
      body: '',
      link: null,
      ...payload,
    })
    if (error) {
      console.error('sendNotification:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.error('sendNotification:', e)
    return false
  }
}
