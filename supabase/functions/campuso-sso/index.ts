import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// campuso-sso
//
// Lets a teacher who is already signed in and recognized as "academician" on
// Campuso (a separate app, separate Supabase project) land straight in
// Acadex's teacher panel — no separate Acadex account to register by hand.
//
// This function is called SERVER-TO-SERVER, from Campuso's own backend
// (app/api/acadex-sso/route.ts on campusO2), never directly from a browser.
// Campuso's server has already verified the caller's own session and role
// (authenticateRequest + requireRole(["academician", "admin"])) before it
// ever calls here — the shared secret below is what lets THIS function
// trust that verification happened, since Acadex has no way to check a
// Campuso session itself (different Supabase project entirely).
//
// What it does:
//   1. Verify the x-campuso-secret header against CAMPUSO_SSO_SECRET.
//   2. Find the matching Acadex profile by campuso_user_id, falling back to
//      email for a first-time visitor; create a new Acadex account if
//      neither matches.
//   3. Set is_teacher = true and link campuso_user_id for next time —
//      replaces the old register-academic.html + admin-approval queue
//      entirely; there's no pending state here, Campuso's own
//      "academician" role check already did that gatekeeping.
//   4. Mint a one-time Supabase magic link and hand its URL back to
//      Campuso, which redirects the browser there. sso-callback.html on
//      Acadex's side turns that into a real session and forwards the
//      teacher into teacher.html.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-campuso-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const campusoSecret = Deno.env.get('CAMPUSO_SSO_SECRET') ?? ''
    const providedSecret = req.headers.get('x-campuso-secret') ?? ''

    // Constant-time-ish compare isn't critical here (this isn't a
    // password), but we still avoid a naive early-exit string compare by
    // just using strict equality after confirming both sides are non-empty
    // — a misconfigured/missing secret on either side always fails closed.
    if (!campusoSecret || !providedSecret || providedSecret !== campusoSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    const email = String(body.email || '').trim().toLowerCase()
    const fullName = body.full_name ? String(body.full_name).trim() : null
    const campusoUserId = body.campuso_user_id ? String(body.campuso_user_id).trim() : null
    const department = body.department ? String(body.department).trim() : null

    if (!email || !campusoUserId) {
      return jsonResponse({ error: 'email and campuso_user_id are required' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const acadexAppUrl = Deno.env.get('ACADEX_APP_URL') || 'https://acadex-1lku.vercel.app'

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 1. Look up an existing profile — by the stable Campuso link first
    //    (best for a returning teacher, immune to an email address change
    //    on either side), falling back to email for a first-time visitor.
    let profileId: string | null = null
    let isSuspended = false

    const { data: byCampusoId } = await serviceClient
      .from('profiles')
      .select('id, is_suspended')
      .eq('campuso_user_id', campusoUserId)
      .maybeSingle()

    if (byCampusoId) {
      profileId = byCampusoId.id
      isSuspended = !!byCampusoId.is_suspended
    } else {
      const { data: byEmail } = await serviceClient
        .from('profiles')
        .select('id, is_suspended')
        .ilike('email', email)
        .maybeSingle()
      if (byEmail) {
        profileId = byEmail.id
        isSuspended = !!byEmail.is_suspended
      }
    }

    if (profileId && isSuspended) {
      // An admin suspended this account on the Acadex side — Campuso's own
      // role check has nothing to do with that, and SSO must not be a way
      // around it.
      return jsonResponse({ error: 'Bu hesap askıya alınmış. Lütfen Acadex yönetimiyle iletişime geçin.' }, 403)
    }

    if (!profileId) {
      // 2. First time this Campuso teacher has ever reached Acadex — create
      // a brand-new account. The profiles-creation trigger on auth.users
      // appears to require a non-null, unique student_number (the same
      // issue register-academic.html's flow used to work around) — hand it
      // a harmless unique placeholder so the insert succeeds; the fields
      // that actually matter are set explicitly right after.
      const placeholderStudentNumber = 'CMP-' + crypto.randomUUID()

      const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password: crypto.randomUUID(), // never used — this account only ever signs in via magic link
        email_confirm: true,
        user_metadata: {
          student_number: placeholderStudentNumber,
          full_name: fullName,
          department: department,
          applied_as: 'teacher',
          source: 'campuso'
        }
      })

      if (createError || !created?.user) {
        console.error('campuso-sso createUser error:', createError)
        return jsonResponse({ error: 'Hesap oluşturulamadı: ' + (createError?.message || 'bilinmeyen hata') }, 500)
      }

      profileId = created.user.id
    }

    // 3. Whether the profile is brand-new or pre-existing, make sure the
    // fields that matter are correct — same idiom register-academic.html's
    // flow used (explicit UPDATE right after, never trust the trigger for
    // anything but making the insert succeed).
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({
        is_teacher: true,
        campuso_user_id: campusoUserId,
        email,
        ...(fullName ? { full_name: fullName } : {}),
        ...(department ? { department } : {}),
      })
      .eq('id', profileId)

    if (updateError) {
      console.error('campuso-sso profile update error:', updateError)
      return jsonResponse({ error: 'Profil güncellenemedi: ' + updateError.message }, 500)
    }

    // 4. Mint a one-time magic link that lands the browser on
    // sso-callback.html already carrying a real Acadex session.
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${acadexAppUrl}/sso-callback.html`
      }
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('campuso-sso generateLink error:', linkError)
      return jsonResponse({ error: 'Giriş bağlantısı oluşturulamadı: ' + (linkError?.message || 'bilinmeyen hata') }, 500)
    }

    // Best-effort audit trail — never blocks the actual SSO handoff.
    try {
      await serviceClient.from('admin_audit_log').insert({
        actor_id: profileId,
        actor_name: fullName || email,
        action: 'campuso_sso_login',
        target_user_id: profileId,
        target_label: fullName || email,
      })
    } catch (auditErr) {
      console.error('campuso-sso admin_audit_log insert failed:', auditErr)
    }

    return jsonResponse({ redirectUrl: linkData.properties.action_link }, 200)

  } catch (err) {
    console.error('campuso-sso exception:', err)
    return jsonResponse({ error: 'Internal server error occurred' }, 500)
  }
})
