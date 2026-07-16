import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const gmailAddress = Deno.env.get('GMAIL_ADDRESS') ?? ''
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Supabase configuration is missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!gmailAddress || !gmailAppPassword) {
      return new Response(JSON.stringify({ error: 'Gmail configuration is missing (GMAIL_ADDRESS or GMAIL_APP_PASSWORD)' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize privileged system client bypassing RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate tomorrow's date string in UTC (format: YYYY-MM-DD)
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const tomorrowDateString = tomorrow.toISOString().split('T')[0]

    console.log(`Checking for study reminders scheduled for UTC date: ${tomorrowDateString}`)

    // Query study_events scheduled for tomorrow that are not done
    const { data: events, error: eventsError } = await supabase
      .from('study_events')
      .select('*')
      .eq('event_date', tomorrowDateString)
      .eq('is_done', false)

    if (eventsError) {
      console.error("Database query failed: ", eventsError)
      return new Response(JSON.stringify({ error: 'Failed to query study events', details: eventsError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!events || events.length === 0) {
      console.log('No reminders due tomorrow.')
      return new Response(JSON.stringify({ success: true, remindersSent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Gather corresponding student profiles to lookup emails
    const userIds = [...new Set(events.map(e => e.user_id))]
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds)

    if (profilesError) {
      console.error("Database profile query failed: ", profilesError)
      return new Response(JSON.stringify({ error: 'Failed to query student profiles', details: profilesError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Map profiles for quick lookup
    const profileMap = new Map()
    profiles?.forEach(p => {
      profileMap.set(p.id, p)
    })

    let remindersSent = 0

    // Loop and dispatch emails
    for (const event of events) {
      const profile = profileMap.get(event.user_id)
      if (!profile || !profile.email) {
        console.warn(`No student email address found for user_id ${event.user_id}`)
        continue
      }

      const studentEmail = profile.email
      const studentName = profile.full_name || 'Student'

      try {
        const client = new SMTPClient({
          connection: {
            hostname: "smtp.gmail.com",
            port: 587,
            tls: true,
            auth: {
              username: gmailAddress,
              password: gmailAppPassword,
            },
          },
        })

        await client.send({
          from: `Acadex <${gmailAddress}>`,
          to: studentEmail,
          subject: `Reminder: ${event.title} is tomorrow!`,
          content: "auto",
          html: `<p>Hi ${studentName},</p><p>This is a friendly reminder that <strong>${event.title}</strong> is scheduled for tomorrow (${event.event_date}).</p>${event.notes ? `<p>Notes: ${event.notes}</p>` : ''}<p>Good luck! — Acadex</p>`,
        })

        await client.close()
        remindersSent++
        console.log(`Reminder email successfully sent to ${studentEmail} for event "${event.title}"`)
      } catch (emailErr) {
        console.error(`Exception occurred sending email to ${studentEmail}:`, emailErr)
      }
    }

    return new Response(JSON.stringify({ success: true, remindersSent }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error("Reminders process execution exception: ", err)
    return new Response(JSON.stringify({ error: 'Internal server error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

