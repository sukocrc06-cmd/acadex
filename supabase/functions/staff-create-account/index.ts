// staff-create-account (05.11.2026)
//
// Yönetim paneli → Finans → "Finans erişimi": e-postanın Acadex hesabı yoksa
// hesabı SUNUCUDA açar, e-postayı onaylı sayar, güçlü bir geçici şifre üretir
// ve finans rolünü takar. Şifre yalnız bu yanıtta, yöneticiye BİR KEZ döner;
// hiçbir yerde saklanmaz ve kayda yazılmaz. Kişi ilk girişte şifresini
// değiştirmeye zorlanır (user_metadata.must_change_password).
//
// Güvenlik:
//   - Çağıran yönetici olmalı (profiles.is_admin, sunucuda denetlenir).
//   - Kapalı beta daveti (admin_invite_add) ve finans rolü (fin_set_staff)
//     ÇAĞIRANIN oturumuyla çalışır: yetki ve denetim kaydı veritabanındaki
//     fonksiyonlardan geçer. Service role yalnız auth.admin.createUser için.
//   - Service role anahtarı Supabase'in kendi ortam değişkenidir; tarayıcıya inmez.
// Dağıtım elle: supabase functions deploy staff-create-account
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// karışmayan harfler (0/O, 1/l/I yok); her türden en az bir karakter
const ALPHA = { lo: 'abcdefghijkmnpqrstuvwxyz', up: 'ABCDEFGHJKLMNPQRSTUVWXYZ', di: '23456789', sy: '!@#$%*?-_' }
export function makePassword(len = 14): string {
  const pick = (set: string) => { const b = new Uint32Array(1); crypto.getRandomValues(b); return set[b[0] % set.length] }
  const all = ALPHA.lo + ALPHA.up + ALPHA.di + ALPHA.sy
  const out = [pick(ALPHA.lo), pick(ALPHA.up), pick(ALPHA.di), pick(ALPHA.sy)]
  while (out.length < len) out.push(pick(all))
  for (let i = out.length - 1; i > 0; i--) { const b = new Uint32Array(1); crypto.getRandomValues(b); const j = b[0] % (i + 1); [out[i], out[j]] = [out[j], out[i]] }
  return out.join('')
}
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

if (import.meta.main) serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Oturum yok.' }, 401)

    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
    const serviceClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser()
    if (callerErr || !caller) return json({ error: 'Oturum geçersiz.' }, 401)
    const { data: me } = await serviceClient.from('profiles').select('is_admin, full_name').eq('id', caller.id).single()
    if (!me?.is_admin) return json({ error: 'Yetki yok: yalnız yöneticiler hesap açabilir.' }, 403)

    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim().toLowerCase()
    const fullName = String(body.full_name ?? '').trim().slice(0, 80)
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: 'Geçerli bir e-posta yaz.' }, 400)

    // 1) kapalı beta daveti (yönetici oturumuyla; kayda geçer). Hesap açılınca erişim izni bundan gelir.
    const inv = await userClient.rpc('admin_invite_add', { p_email: email, p_note: 'Finans ekibi' })
    if (inv.error) return json({ error: 'Davet eklenemedi: ' + inv.error.message }, 400)

    // 2) hesap zaten var mı?
    const { data: existing } = await serviceClient.from('profiles').select('id, full_name').ilike('email', email).maybeSingle()
    let password: string | null = null, created = false, name = existing?.full_name || fullName || null
    if (!existing) {
      password = makePassword(14)
      const { data: cu, error: cuErr } = await serviceClient.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: fullName || undefined, must_change_password: true, created_by_admin: caller.id },
      })
      if (cuErr || !cu?.user) {
        const m = String(cuErr?.message || '')
        if (/already|registered|exists/i.test(m)) return json({ error: 'Bu e-postayla bir giriş hesabı var ama profili yok. Kullanıcılar bölümünden bakın.' }, 409)
        return json({ error: 'Hesap açılamadı: ' + m }, 400)
      }
      created = true
      try {
        await serviceClient.from('admin_audit_log').insert({ actor_id: caller.id, actor_name: me.full_name || caller.email || null, action: 'fin_account_create', target_user_id: cu.user.id, target_label: fullName || email, details: { email, onayli: true, gecici_sifre: true } })
      } catch (_e) { /* kayıt hatası işlemi durdurmaz */ }
    }

    // 3) finans rolü (yönetici oturumuyla; fin_set_staff kendisi denetler ve kaydeder)
    const role = await userClient.rpc('fin_set_staff', { p_email: email, p_on: true })
    if (role.error) return json({ error: 'Hesap ' + (created ? 'açıldı' : 'var') + ' ama rol verilemedi: ' + role.error.message, created, password }, 500)
    name = role.data?.name || name

    return json({ ok: true, created, email, name, password })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
