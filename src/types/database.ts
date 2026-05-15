export type Mode = 'qa' | 'consultation' | 'procedure'

export interface Profile {
  id: string
  display_name: string
  department: string | null
  employee_id: string | null
  avatar_url: string | null
  total_conversations: number
  total_good_count: number
  total_bad_count: number
  sherpa_solve_count: number
  good_badge_rank: number // 1: Blue, 2: Orange, 3: Purple
  is_sherpa: boolean
  selected_badge: 'good' | 'sherpa'
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  mode: Mode
  started_at: string
  ended_at: string | null
  message_count: number
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  emotion: string
  created_at: string
}

export interface Feedback {
  id: string
  message_id: string
  user_id: string
  feedback_type: 'good' | 'bad'
  created_at: string
}

export interface UnsolvedQuestion {
  id: string
  user_id: string
  message_id: string | null
  question_text: string
  ai_answer_text: string | null
  category_id: string | null
  mode: Mode
  status: 'open' | 'answered' | 'resolved'
  empathy_count: number
  created_at: string
  resolved_at: string | null
  // Joined fields
  category?: Category
  author?: Pick<Profile, 'display_name' | 'department' | 'good_badge_rank' | 'is_sherpa'>
  answers_count?: number
}

export interface UnsolvedAnswer {
  id: string
  question_id: string
  answerer_id: string
  answer_text: string
  is_accepted: boolean
  created_at: string
  // Joined
  answerer?: Pick<Profile, 'display_name' | 'department' | 'good_badge_rank' | 'is_sherpa'>
}

export interface Category {
  id: string
  name: string
  display_order: number
}

export interface Notification {
  id: string
  user_id: string
  type: 'answer_posted' | 'question_resolved' | 'badge_earned'
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
}

export function getBadgeInfo(goodCount: number, isSherpa: boolean, selectedBadge: 'good' | 'sherpa' = 'good') {
  const goodBadge = goodCount >= 30
    ? { rank: 3, label: 'Summiteer', color: 'purple', image: '/badges/good-purple.png' }
    : goodCount >= 10
    ? { rank: 2, label: 'Climber', color: 'orange', image: '/badges/good-orange.png' }
    : { rank: 1, label: 'Trekker', color: 'blue', image: '/badges/good-blue.png' }

  const sherpaBadge = { rank: 'sherpa' as const, label: 'Sherpa', color: 'pink', image: '/badges/sherpa.png' }

  if (selectedBadge === 'sherpa' && isSherpa) return sherpaBadge
  return goodBadge
}
