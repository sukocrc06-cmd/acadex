-- ==========================================================================
-- ACADEX — KAVRAM İNDEKSİ DOLDURULUYOR (public.user_concept_index)
--
-- NEDEN VAR (01.11.2026): tablo 17.08.2026'da `20260817d_cross_doc_knowledge_
-- graph.sql` ile kuruldu ama hiç yazılmadı — **0 satır**. O migration'ın kendi
-- notu "Optional: run a nightly job or 'Refresh graph' button to populate"
-- diyor; o iş hiç yapılmadı. İstemcide tabloya değen tek satır yok (arandı:
-- js/, *.html, supabase/ — yalnız kendi migration'ında geçiyor). Kırık bir
-- yazıcı yok, hiç yazıcı yok.
--
-- ÖLÇÜLEN KAYNAK VERİ (01.11.2026, 107 kart):
--   key_terms      : 106 kartta 1.474 öğe, ortalama 13,8 — hepsinin 'term'i var
--   concept_graph  : yalnız 12 kartta düğüm var, toplam 85, kart başına en çok 13
--                    düğüm yapısı {id, label, type}, type tek değer: 'concept'
-- Yani indeksin gövdesi key_terms'ten gelir; concept_graph onu zenginleştirir.
-- Tablonun `source` kolonu bu ikiliyi zaten öngörmüş: 'concept_graph'|'key_term'.
--
-- NE KAZANDIRIR: kavramlar bugün yalnız kartın JSON'unun içinde duruyor, yani
-- SQL'den sorgulanamıyor. İndeks dolunca "bu kavram hangi belgelerde geçiyor"
-- ve "öğrenci şu kavramda zayıf, o kavram hangi kartta anlatılıyor" soruları
-- join ile cevaplanabilir hale gelir (question_attempts.concept ↔ concept_key).
--
-- GÜVENLİK TASARIMI:
--  1) Tetikleyici study_cards'ın SICAK yazma yoluna takılı (summarize-document
--     kartı oraya yazıyor). Bu yüzden gövde exception ile sarılı: indeks
--     güncellenemezse UYARI basar, kart yazması ASLA düşmez.
--  2) rebuild_card_concept_index SECURITY DEFINER (RLS'i aşar) ve dışarıya da
--     açık, çünkü ileride "Grafiği yenile" düğmesi çağırabilir. Bu yüzden
--     içinde sahiplik kapısı var: auth.uid() doluysa kartın sahibi olmalı.
--     Tetikleyiciden gelindiğinde (service role) auth.uid() boştur, geçer.
--
-- Teste bağlı: tests/kavram-indeksi.js
-- ==========================================================================

/* Eşleştirme anahtarı: küçük harf + boşluk sadeleştirme + kırpma.
   IMMUTABLE, böylece sorguda ve gerekirse indekste de kullanılabilir.
   Türkçe harfler için lower() UTF-8'de doğru çalışıyor ('Şekilli' -> 'şekilli'). */
create or replace function public.concept_key_of(p_label text)
returns text
language sql
immutable
as $$
  select nullif(btrim(regexp_replace(lower(coalesce(p_label, '')), '\s+', ' ', 'g')), '')
$$;

create or replace function public.rebuild_card_concept_index(p_card_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user  uuid;
  v_sayi  integer := 0;
begin
  select user_id into v_user from public.study_cards where id = p_card_id;
  if v_user is null then
    return 0;                       -- kart yok ya da silinmiş
  end if;

  /* SAHİPLİK KAPISI: dışarıdan çağrı kendi kartından başkasına dokunamaz.
     Tetikleyici/service role yolunda auth.uid() boş olur ve kapı geçilir. */
  if auth.uid() is not null and auth.uid() <> v_user then
    raise exception 'kavram indeksi: bu kart size ait degil';
  end if;

  delete from public.user_concept_index where study_card_id = p_card_id;

  with kart as (
    select id, user_id, document_id, course_tag, concept_graph, key_terms
      from public.study_cards
     where id = p_card_id
  ),
  kaynak as (
    /* concept_graph düğümleri. İstemci etiketi `n.label || n.id` diye okuyor
       (js/acadex-ink.js -> netData); indekste id'ye düşmüyoruz, çünkü "c1"
       gibi bir anahtar gürültüden başka bir şey değil. */
    select k.user_id, k.id as study_card_id, k.document_id, k.course_tag,
           n->>'label' as label, 'concept_graph'::text as source
      from kart k
           cross join lateral jsonb_array_elements(
             case when jsonb_typeof(k.concept_graph->'nodes') = 'array'
                  then k.concept_graph->'nodes' else '[]'::jsonb end) n
     where coalesce(n->>'type', 'concept') = 'concept'
    union all
    select k.user_id, k.id, k.document_id, k.course_tag,
           t->>'term', 'key_term'::text
      from kart k
           cross join lateral jsonb_array_elements(
             case when jsonb_typeof(k.key_terms) = 'array'
                  then k.key_terms else '[]'::jsonb end) t
  ),
  temiz as (
    /* Kart içinde aynı anahtar bir kez: UNIQUE (user_id, concept_key,
       study_card_id) zaten bunu şart koşuyor. Çakışmada concept_graph
       kazanır, çünkü o kavramı belgenin yapısından çıkarmış. */
    select distinct on (public.concept_key_of(label))
           user_id, study_card_id, document_id, course_tag,
           btrim(label)                   as concept_label,
           public.concept_key_of(label)   as concept_key,
           source
      from kaynak
     where public.concept_key_of(label) is not null
     order by public.concept_key_of(label), (source = 'concept_graph') desc
  )
  insert into public.user_concept_index
        (user_id, concept_label, concept_key, study_card_id, document_id, course_tag, source)
  select user_id, concept_label, concept_key, study_card_id, document_id, course_tag, source
    from temiz
  on conflict (user_id, concept_key, study_card_id) do nothing;

  get diagnostics v_sayi = row_count;
  return v_sayi;
end $$;

create or replace function public.study_cards_concept_index_tg()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  /* İNDEKS ASLA KART YAZMASINI DÜŞÜRMEZ. Bu tetikleyici summarize-document'in
     sıcak yoluna takılı; indeks bir yan ürün, kartın kendisi değil. */
  begin
    perform public.rebuild_card_concept_index(new.id);
  exception when others then
    raise warning 'user_concept_index guncellenemedi (card=%): %', new.id, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists trg_study_cards_concept_index on public.study_cards;
create trigger trg_study_cards_concept_index
  after insert or update of concept_graph, key_terms, course_tag, document_id
  on public.study_cards
  for each row
  execute function public.study_cards_concept_index_tg();

/* YETKİLER: anon hiçbirini çağıramaz. */
revoke all on function public.concept_key_of(text) from public;
revoke all on function public.rebuild_card_concept_index(uuid) from public;
revoke all on function public.study_cards_concept_index_tg() from public;
grant execute on function public.concept_key_of(text) to authenticated, service_role;
grant execute on function public.rebuild_card_concept_index(uuid) to authenticated, service_role;

/* GERİYE DOLDURMA: mevcut 107 kart. Tetikleyici bundan sonrasını üstlenir. */
do $$
declare
  r       record;
  v_kart  integer := 0;
  v_satir integer := 0;
begin
  for r in select id from public.study_cards loop
    v_satir := v_satir + public.rebuild_card_concept_index(r.id);
    v_kart  := v_kart + 1;
  end loop;
  raise notice 'user_concept_index dolduruldu: % kart, % satir', v_kart, v_satir;
end $$;
