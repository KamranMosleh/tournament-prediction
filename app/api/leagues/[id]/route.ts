import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{ id: string }>
}

async function getOwnedLeague(id: string) {
  const user = await getCurrentUser()
  if (!user) {
    return { response: NextResponse.json({ error: 'Sign in required' }, { status: 401 }) }
  }

  const supabase = createServiceClient()
  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!league) {
    return { response: NextResponse.json({ error: 'League not found' }, { status: 404 }) }
  }

  if (!league.created_by_user_id || league.created_by_user_id !== user.id) {
    return { response: NextResponse.json({ error: 'Only the league owner can do this' }, { status: 403 }) }
  }

  return { supabase, league, user }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const owned = await getOwnedLeague(id)
  if ('response' in owned) return owned.response

  const body = await req.json().catch(() => ({}))
  const action = body.action
  if (action !== 'archive' && action !== 'restore') {
    return NextResponse.json({ error: 'Action must be archive or restore' }, { status: 400 })
  }

  const archived = action === 'archive'
  const { data: league, error } = await owned.supabase
    .from('leagues')
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      archived_by_user_id: archived ? owned.user.id : null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error || !league) {
    return NextResponse.json({ error: `Failed to ${action} league` }, { status: 500 })
  }

  return NextResponse.json({ league })
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const owned = await getOwnedLeague(id)
  if ('response' in owned) return owned.response

  const body = await req.json().catch(() => ({}))
  const confirmation = typeof body.confirm_invite_code === 'string'
    ? body.confirm_invite_code.trim().toUpperCase()
    : ''

  if (confirmation !== owned.league.invite_code) {
    return NextResponse.json({ error: 'Invite code confirmation does not match' }, { status: 400 })
  }

  const { error } = await owned.supabase
    .from('leagues')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to permanently delete league' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
