import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  attachReactionToOptions,
  attachUndercoverVoteToOptions,
} from '@/lib/mystery'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action, waveId, memberId, memberName, responseId, emoji, suspectMemberId } = body

    if (!waveId || !action) {
      return NextResponse.json({ error: 'Missing waveId or action' }, { status: 400 })
    }

    const { data: wave, error: waveError } = await supabase
      .from('waves')
      .select('*')
      .eq('id', waveId)
      .single()

    if (waveError || !wave) {
      return NextResponse.json({ error: 'Wave not found' }, { status: 404 })
    }

    // 1. Live Reaction on a Reveal Card
    if (action === 'toggle_reaction') {
      if (!responseId || !memberId || !emoji) {
        return NextResponse.json({ error: 'Missing reaction fields' }, { status: 400 })
      }
      const nextOptions = attachReactionToOptions(wave.options, responseId, {
        memberId,
        memberName: memberName || 'Freund',
        emoji,
      })
      const { error } = await supabase
        .from('waves')
        .update({ options: nextOptions })
        .eq('id', waveId)

      if (error) throw error
      return NextResponse.json({ success: true, options: nextOptions })
    }

    // 2. Live Vote in Undercover Mode
    if (action === 'cast_vote') {
      if (!memberId || !suspectMemberId) {
        return NextResponse.json({ error: 'Missing vote fields' }, { status: 400 })
      }
      const nextOptions = attachUndercoverVoteToOptions(
        wave.options,
        memberId,
        suspectMemberId
      )
      const { error } = await supabase
        .from('waves')
        .update({ options: nextOptions })
        .eq('id', waveId)

      if (error) throw error
      return NextResponse.json({ success: true, options: nextOptions })
    }

    // 3. Force Reveal (Deadlock-Brecher falls ein Mitglied schläft/offline ist)
    if (action === 'force_reveal') {
      const { data: updated, error } = await supabase
        .from('waves')
        .update({ status: 'reveal', revealed_at: new Date().toISOString() })
        .eq('id', waveId)
        .eq('status', 'active')
        .select()

      if (error) throw error
      return NextResponse.json({
        success: true,
        transitioned: !!(updated && updated.length > 0),
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('[Wave Action] Error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
