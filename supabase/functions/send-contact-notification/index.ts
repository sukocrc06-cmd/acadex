import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const body = await req.json()
    const { name, email, message } = body

    // Validate all three fields are present and non-empty
    if (!name || !email || !message ||
        String(name).trim() === "" ||
        String(email).trim() === "" ||
        String(message).trim() === "") {
      return new Response(
        JSON.stringify({ error: "name, email, and message are all required and must not be empty." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY")
    const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL")

    if (!resendApiKey || !adminEmail) {
      console.error("send-contact-notification: RESEND_API_KEY or ADMIN_NOTIFICATION_EMAIL secret is not set.")
      // Secrets not configured — treat gracefully (message already saved in DB)
      return new Response(
        JSON.stringify({ success: true, emailSent: false, reason: "Email service not configured." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Call Resend API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Acadex Contact Form <onboarding@resend.dev>",
        to: [adminEmail],
        reply_to: email,
        subject: `New Acadex contact message from ${name}`,
        text: `From: ${name} (${email})\n\n${message}`,
        html: `<p><strong>From:</strong> ${name} (<a href="mailto:${email}">${email}</a>)</p><p>${String(message).replace(/\n/g, "<br>")}</p>`,
      }),
    })

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text()
      console.error("Resend API error:", resendResponse.status, resendError)
      // Email failed — message is already safely in contact_messages, so return soft success
      return new Response(
        JSON.stringify({ success: true, emailSent: false, reason: "Email delivery failed." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, emailSent: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    console.error("send-contact-notification unexpected error:", err)
    // Return soft success — contact_messages insert already happened before this function was called
    return new Response(
      JSON.stringify({ success: true, emailSent: false, reason: "Unexpected server error." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
