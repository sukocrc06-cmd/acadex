import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Fetch user details from auth token
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = user.id

    // Service role client to perform storage cleanup and user deletion
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 1. List and remove all files in user storage directory (userId/)
    try {
      const { data: files, error: listError } = await serviceClient.storage
        .from('documents')
        .list(userId)

      if (listError) {
        console.error("Storage list files error (continuing user delete): ", listError)
      } else if (files && files.length > 0) {
        const filePaths = files.map(f => `${userId}/${f.name}`)
        const { error: removeError } = await serviceClient.storage
          .from('documents')
          .remove(filePaths)
        
        if (removeError) {
          console.error("Storage remove files error (continuing user delete): ", removeError)
        }
      }
    } catch (storageErr) {
      console.error("Gracefully caught storage deletion exception: ", storageErr)
    }

    // 2. Delete auth user (cascades via database RLS and foreign key dependencies to profiles, documents, cards, exams, notebooks)
    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(userId)
    if (deleteUserError) {
      console.error("Auth admin deleteUser error: ", deleteUserError)
      return new Response(JSON.stringify({ error: 'Failed to delete user auth account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error("delete-account exception: ", err)
    return new Response(JSON.stringify({ error: 'Internal server error occurred' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
