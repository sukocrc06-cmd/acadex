/* ==========================================================================
   ACADEX — PGlite TABANI (tests/_pglite-taban.js)  (28.11.2026, #58 Phase 12)

   Gerçek Postgres (PGlite, WASM) içinde Faz 12 migration'larını RLS ile sınamak için ortak kurulum.
   Taban şema Supabase'in yalnız gereken parçalarının taklididir: auth.uid()/auth.jwt() (request.jwt.claim.sub /
   request.jwt.claims), authenticated/anon rolleri, misafir_mi(), pgcrypto "extensions" şemasında ve sunum tablolarının
   (presentations, presentation_slides, presentation_versions) sahip-yalnız RLS'li çekirdeği. Canlı veritabanı değildir.

   Paket: PGLITE_DIR (@electric-sql/pglite bulunan node_modules) ya da repodaki node_modules. Yoksa pgKur() null döner
   ve testler ATLANDI yazar (GEÇTİ sayılmaz). Ağ yok.
   ========================================================================== */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const pgDizin = () => [process.env.PGLITE_DIR, path.join(ROOT, 'node_modules')].filter(Boolean).find((d) => fs.existsSync(path.join(d, '@electric-sql/pglite/package.json'))) || null;

const TABAN = `create schema extensions; create extension pgcrypto schema extensions; create role authenticated nologin; create role anon nologin; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
grant usage on schema auth, extensions to authenticated, anon;
create function public.misafir_mi() returns boolean language sql stable as $$ select coalesce((auth.jwt()->>'is_anonymous')::boolean,false) $$;
create table public.presentations(id uuid primary key default gen_random_uuid(), user_id uuid not null, title text, share_token text, share_snapshot jsonb, shared_at timestamptz, updated_at timestamptz default now(), slide_count int);
create table public.presentation_slides(id uuid primary key default gen_random_uuid(), presentation_id uuid references public.presentations(id) on delete cascade, order_index int, content jsonb, speaker_notes text);
create table public.presentation_versions(id uuid primary key default gen_random_uuid(), presentation_id uuid references public.presentations(id) on delete cascade, version_no int, reason text default 'manual_snapshot', created_by_type text default 'user', snapshot jsonb, created_at timestamptz default now());
alter table public.presentations enable row level security; alter table public.presentation_slides enable row level security; alter table public.presentation_versions enable row level security;
create policy presentations_select_own on public.presentations for select to authenticated using (auth.uid() = user_id);
create policy presentations_insert_own on public.presentations for insert to authenticated with check (auth.uid() = user_id);
create policy presentations_update_own on public.presentations for update to authenticated using (auth.uid() = user_id);
create policy presentations_delete_own on public.presentations for delete to authenticated using (auth.uid() = user_id);
create policy slides_own on public.presentation_slides for all to authenticated using (exists (select 1 from public.presentations p where p.id = presentation_id and p.user_id = auth.uid())) with check (exists (select 1 from public.presentations p where p.id = presentation_id and p.user_id = auth.uid()));
create policy versions_own on public.presentation_versions for all to authenticated using (exists (select 1 from public.presentations p where p.id = presentation_id and p.user_id = auth.uid())) with check (exists (select 1 from public.presentations p where p.id = presentation_id and p.user_id = auth.uid()));
grant select, insert, update, delete on public.presentations, public.presentation_slides, public.presentation_versions to authenticated;`;

/* pgKur(['20261128_....sql', ...]) → { db, kok, kim } ya da null.
   kim(uid, { misafir, anon }) → o kimlikle sorgu çalıştıran q(sql, params): { rows } ya da { hata: SQLSTATE }. */
const pgKur = async (dosyalar) => {
  const dz = pgDizin(); if (!dz) return null;
  const { PGlite } = await import(pathToFileURL(path.join(dz, '@electric-sql/pglite/dist/index.js')).href);
  const { pgcrypto } = await import(pathToFileURL(path.join(dz, '@electric-sql/pglite/dist/contrib/pgcrypto.js')).href);
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(TABAN);
  for (const f of dosyalar) await db.exec(fs.readFileSync(path.join(ROOT, 'supabase/migrations', f), 'utf8').replace(/\r\n/g, '\n'));
  const kok = async (sql, p) => (await db.query(sql, p || [])).rows;
  const kim = (uid, o) => async (sql, p) => {
    o = o || {};
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)", [o.anon ? '' : uid, o.anon ? '{}' : JSON.stringify({ sub: uid, is_anonymous: !!o.misafir, role: 'authenticated' })]);
    await db.exec(o.anon ? 'set role anon' : 'set role authenticated');
    try { return { rows: (await db.query(sql, p || [])).rows }; } catch (e) { return { hata: e.code || 'XX000', ileti: String(e.message || e).slice(0, 160) }; } finally { await db.exec('reset role'); }
  };
  return { db, kok, kim };
};

module.exports = { pgKur, pgDizin };
