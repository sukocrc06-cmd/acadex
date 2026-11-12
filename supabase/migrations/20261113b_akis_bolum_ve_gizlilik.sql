-- ==========================================================================
-- ACADEX — BÖLÜM AKIŞI: bölüm sekmesi, görünme tercihi, raptiye gizliliği
-- 13.11.2026. Tekrar çalıştırmak güvenlidir.
--
-- Denetimde çıkanlar + Berkay'ın istekleri:
--
-- 1) GÖRÜNME TERCİHİ: "isteyen kendi ismiyle, isteyen 'Bir arkadaş' olarak
--    görünsün." profiles.akis_gizli kullanıcının kendi seçimi; public_profiles
--    ona saygı duyar (ad ve avatar null döner). Tercih HEM bölüm akışında HEM
--    sandbox panelinde geçerlidir — iki yerde iki ayrı kimlik kafa karıştırır.
--    Kullanıcı kendi adını her yerde görmeye devam eder (istemci kendi
--    profilinden okur), tercih yalnız BAŞKALARININ gördüğünü değiştirir.
--
-- 2) BÖLÜM SEKMESİ: akış şimdiye dek yalnız kendi bölümünü gösteriyordu.
--    Artık paylaşılan kartlar bölüm seçilerek gezilebilir (YBS, İşletme,
--    Bankacılık…). Bunun için SELECT politikası bölüm şartından kurtulur:
--    PAYLAŞILMIŞ kart giriş yapmış herkese açıktır. Paylaşmayan kart
--    (is_shared=false) eskisi gibi yalnız sahibinindir.
--
-- 3) RAPTİYE GİZLİLİĞİ (denetim bulgusu): study_card_votes'un SELECT
--    politikası 'true' idi — giriş yapan herkes KİMİN neyi raptiyelediğini
--    okuyabiliyordu. Artık ham satırlar yalnız kendi raptiyen ve KENDİ
--    kartına gelen raptiyeler için görünür ("kartına raptiye takıldı"
--    bildirimi bunu kullanır). Sayılar herkese açık study_card_pin_counts
--    görünümünden gelir: kaç kişi raptiyelemiş görünür, kim olduğu görünmez.
--
-- Teste bağlı: tests/bolum-akisi.js
-- ==========================================================================

-- 1) GÖRÜNME TERCİHİ --------------------------------------------------------
alter table public.profiles
  add column if not exists akis_gizli boolean not null default false;

comment on column public.profiles.akis_gizli is
  'true: paylaşımlarda "Bir arkadaş" olarak görünür (ad ve avatar paylaşılmaz).';

create or replace view public.public_profiles
with (security_invoker = off) as
  select id,
         case when coalesce(akis_gizli, false) then null else full_name end as full_name,
         department,
         case when coalesce(akis_gizli, false) then null else avatar_url end as avatar_url,
         case when coalesce(akis_gizli, false) then null else banner_url end as banner_url,
         case when coalesce(akis_gizli, false) then null else bio end as bio,
         case when coalesce(akis_gizli, false) then null else github_url end as github_url,
         case when coalesce(akis_gizli, false) then null else linkedin_url end as linkedin_url,
         case when coalesce(akis_gizli, false) then null else website_url end as website_url,
         coalesce(akis_gizli, false) as gizli
    from public.profiles
   where coalesce(is_suspended, false) = false;

comment on view public.public_profiles is
  'Panelde gösterilen herkese açık profil kolonları. security_invoker=off '
  'bilerek: profiles RLS''i yalnız bu dar kolon listesi için aşılır. '
  'akis_gizli seçen kullanıcının adı/avatarı null döner (gizli=true). '
  'email / student_number / is_admin BU GÖRÜNÜME ASLA EKLENMEZ.';

-- 2) BÖLÜM SEKMESİ: paylaşılan kart bölüm farkı gözetmeden görünür ----------
drop policy if exists "Users can view shared study cards in their department" on public.study_cards;
drop policy if exists study_cards_select_shared on public.study_cards;
create policy study_cards_select_shared on public.study_cards
  for select to authenticated
  using (is_shared = true);

-- 3) RAPTİYE: sayı herkese, kim olduğu yalnız ilgilisine --------------------
drop policy if exists study_card_votes_select_authenticated on public.study_card_votes;
drop policy if exists study_card_votes_select_own_or_owner on public.study_card_votes;
create policy study_card_votes_select_own_or_owner on public.study_card_votes
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from public.study_cards c
                where c.id = study_card_votes.card_id and c.user_id = auth.uid())
  );

create or replace view public.study_card_pin_counts
with (security_invoker = off) as
  select v.card_id, count(*)::integer as n
    from public.study_card_votes v
    join public.study_cards c on c.id = v.card_id and c.is_shared = true
   group by v.card_id;

comment on view public.study_card_pin_counts is
  'Paylaşılan kartların raptiye SAYISI (kim olduğu yok). Ham study_card_votes '
  'yalnız kendi raptiyen ve kendi kartına geleni gösterir.';

grant select on public.study_card_pin_counts to authenticated;

notify pgrst, 'reload schema';
