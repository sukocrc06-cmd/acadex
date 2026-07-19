import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// notify-role-change
//
// Sends the affected user a short email when an admin promotes them to
// hoca (teacher) or admin from admin.html. Reuses the same Resend setup
// already configured for supabase/functions/send-contact-notification —
// no new secrets needed beyond the RESEND_API_KEY that function relies on.
//
// Like admin-manage-user, this requires the caller's own profile to have
// is_admin = true; it is never trusted from the client.

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

    const { data: callerProfile, error: callerProfileError } = await serviceClient
      .from('profiles')
      .select('is_admin')
      .eq('id', caller.id)
      .single()

    if (callerProfileError || !callerProfile || !callerProfile.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { targetUserId, newRole } = body

    if (!targetUserId || !['teacher', 'admin'].includes(newRole)) {
      return new Response(JSON.stringify({ error: 'targetUserId and a valid newRole (teacher|admin) are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: targetProfile, error: targetError } = await serviceClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', targetUserId)
      .single()

    if (targetError || !targetProfile || !targetProfile.email) {
      return new Response(JSON.stringify({ error: 'Target user profile or email not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('notify-role-change: RESEND_API_KEY secret is not set.')
      // Not fatal — the role change itself already happened via admin.html.
      return new Response(JSON.stringify({ success: true, emailSent: false, reason: 'Email service not configured.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const roleLabelTr = newRole === 'admin' ? 'Admin' : 'Hoca (Öğretim Üyesi)'
    const portalUrl = newRole === 'admin' ? 'admin.html' : 'teacher.html'
    const firstName = (targetProfile.full_name || '').split(' ')[0] || ''

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Acadex <onboarding@resend.dev>',
        to: [targetProfile.email],
        subject: `Acadex hesabınıza ${roleLabelTr} yetkisi tanımlandı`,
        text: `Merhaba ${firstName || ''},\n\nAcadex hesabınıza ${roleLabelTr} yetkisi tanımlandı. Mevcut hesabınızla giriş yaptığınızda otomatik olarak yeni panelinize yönlendirileceksiniz (${portalUrl}).\n\nBu değişikliği siz talep etmediyseniz lütfen program koordinatörüyle iletişime geçin.`,
        html: `<p>Merhaba ${firstName || ''},</p><p>Acadex hesabınıza <strong>${roleLabelTr}</strong> yetkisi tanımlandı. Mevcut hesabınızla giriş yaptığınızda otomatik olarak yeni panelinize yönlendirileceksiniz.</p><p>Bu değişikliği siz talep etmediyseniz lütfen program koordinatörüyle iletişime geçin.</p>`,
      }),
    })

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text()
      console.error('Resend API error:', resendResponse.status, resendError)
      return new Response(JSON.stringify({ success: true, emailSent: false, reason: 'Email delivery failed.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, emailSent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('notify-role-change exception:', err)
    return new Response(JSON.stringify({ success: true, emailSent: false, reason: 'Unexpected server error.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
