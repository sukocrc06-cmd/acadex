import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// admin-manage-user
//
// Server-side actions that the admin panel (admin.html) cannot safely do
// with just the anon key + RLS, because they touch Supabase Auth itself
// (banning/unbanning a login, or deleting another person's account).
// Role/department edits on `profiles` are done directly from admin.html via
// RLS (profiles_admin_update_all) — this function is only for the handful
// of actions that require the service role.
//
// Mirrors the auth pattern already used in supabase/functions/delete-account:
// verify the caller's JWT, then use a service-role client for the privileged
// part — but here we additionally require the caller's own profile to have
// is_admin = true before doing anything to another user's account.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser()
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Confirm the caller is an admin (checked server-side; never trust the client).
    const { data: callerProfile, error: callerProfileError } = await serviceClient
      .from('profiles')
      .select('is_admin, full_name')
      .eq('id', caller.id)
      .single()

    if (callerProfileError || !callerProfile || !callerProfile.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { action, targetUserId } = body

    if (!action || !targetUserId) {
      return new Response(JSON.stringify({ error: 'action and targetUserId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Safety rail: an admin can't lock themselves out or delete their own
    // account through this bulk-management endpoint.
    if (targetUserId === caller.id && (action === 'suspend' || action === 'delete')) {
      return new Response(JSON.stringify({ error: 'You cannot suspend or delete your own account from here.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Best-effort label for the audit log — never blocks the actual action.
    let targetLabel = targetUserId
    try {
      const { data: targetProfile } = await serviceClient
        .from('profiles')
        .select('full_name, email')
        .eq('id', targetUserId)
        .single()
      if (targetProfile) targetLabel = targetProfile.full_name || targetProfile.email || targetUserId
    } catch (_labelErr) {
      // ignore — fall back to the raw id
    }

    const writeAuditLog = async (auditAction: string) => {
      try {
        await serviceClient.from('admin_audit_log').insert({
          actor_id: caller.id,
          actor_name: callerProfile.full_name || caller.email || caller.id,
          action: auditAction,
          target_user_id: targetUserId,
          target_label: targetLabel
        })
      } catch (auditErr) {
        // Audit logging must never block the actual admin action.
        console.error('admin_audit_log insert failed:', auditErr)
      }
    }

    if (action === 'suspend') {
      const { error } = await serviceClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: '876000h' // ~100 years — effectively indefinite until unsuspended
      })
      if (error) throw error
      await serviceClient.from('profiles').update({ is_suspended: true }).eq('id', targetUserId)
      await writeAuditLog('suspend')

    } else if (action === 'unsuspend') {
      const { error } = await serviceClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: 'none'
      })
      if (error) throw error
      await serviceClient.from('profiles').update({ is_suspended: false }).eq('id', targetUserId)
      await writeAuditLog('unsuspend')

    } else if (action === 'delete') {
      // Best-effort storage cleanup, same pattern as delete-account.
      try {
        const { data: files } = await serviceClient.storage.from('documents').list(targetUserId)
        if (files && files.length > 0) {
          const filePaths = files.map((f: { name: string }) => `${targetUserId}/${f.name}`)
          await serviceClient.storage.from('documents').remove(filePaths)
        }
      } catch (storageErr) {
        console.error('Storage cleanup error (continuing delete):', storageErr)
      }

      const { error } = await serviceClient.auth.admin.deleteUser(targetUserId)
      if (error) throw error
      await writeAuditLog('delete')

    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('admin-manage-user exception:', err)
    return new Response(JSON.stringify({ error: 'Internal server error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
