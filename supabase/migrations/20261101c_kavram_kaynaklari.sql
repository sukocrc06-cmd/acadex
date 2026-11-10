-- ==========================================================================
-- ACADEX — ZAYIF KAVRAM → NEREDE ANLATILIYOR (public.concept_study_sources)
--
-- NEDEN VAR (01.11.2026): ustalık tahmini zaten var ve iyi — js/exam-engine.js
-- içinde BKT (prior/slip/learn, soru tipine göre şans payı, "işaretledim" ve
-- ipucu güven ağırlıkları) + FSRS unutma eğrisi, az veri kapılarıyla birlikte
-- ("yetkin" n>=3, "usta" n>=5 ve iki ayrı gün). Eksik olan tahmin değil, ÇARE.
--
-- ÖLÇÜLEN BOŞLUK — ÖNCÜL 10.11.2026'DA DÜZELTİLDİ.
-- Bu blok önce js/dashboard.js -> loadWeakConceptMap / practiceWeakConcept'i
-- işaret ediyordu. YANLIŞTI: o kod ekranda yok; #exam-weak-concepts-list
-- dashboard.html'de display:none bir kabın içinde (sınav salonu yeniden
-- tasarlanınca gizlendi). Ekrana çizen yol js/acadex-ink.js -> paintMastery
-- ve orada "bu konudan deneme" ZATEN var (kart masasında data-focus-key +
-- data-concept, ders masasında data-practice), yani karttan gelen zayıflıkta
-- öğrenci ders ağacına atılmıyor.
-- Gerçek boşluk tek: "oku" yolu. Öğrenci içeriğe geri dönmüyor,
-- çünkü "bu kavram hangi belgede anlatılıyor" bilgisi 01.11 öncesinde
-- sorgulanabilir değildi (user_concept_index 2,5 ay boyunca 0 satır).
-- 20261101b_kavram_indeksi.sql onu doldurdu (1.526 satır, 756 tekil kavram).
--
-- NE YAPAR: bir kavram listesi alır, her biri için o kavramı anlatan kartları
-- ve belgeleri döndürür. Ustalık HESAPLAMAZ — o iş exam-engine'de, burada
-- kopyası tutulmaz (CLAUDE.md §3: ekstra soyutlama katmanı uydurma).
--
-- EŞLEŞME İKİ KADEMELİ ve ETİKETLİ: 'exact' (normalize anahtar birebir) ve
-- 'contains' (biri ötekini içeriyor). İkinci kademe şart, çünkü ölçüldü:
-- ders sınavlarının kavramları kartın key_terms dağarcığından gelmiyor, bu
-- yüzden birebir eşleşme ders sınavlarında çoğunlukla boş döner. Çağıran
-- hangi kademeden geldiğini görür ve ona göre güvenir.
--
-- GÜVENLİK: SECURITY INVOKER (varsayılan) — RLS olduğu gibi uygulanır,
-- kullanıcı yalnız kendi indeksini ve kendi belgelerini görür. auth.uid()
-- boşsa hiç satır dönmez.
--
-- ARAYÜZ BAĞLANTISI BU MIGRATION'IN İŞİ DEĞİL ve yeri BELLİ:
-- js/acadex-ink.js -> paintMastery. Satır başına değil, düğme çıkan kavramlar
-- için TEK toplu çağrı: rpc('concept_study_sources', { p_concepts: [...] }).
-- Eşleşme seçimi: önce o masanın kartları içinden 'exact', yoksa yine masa
-- içinden 'contains', ders masasında genel 'exact'. Masa dışında 'contains'
-- kabul edilmemeli — "faiz" gibi kısa kavramlar her şeyi yakalar.
-- dashboard.js'teki gizli yola BAĞLANMAMALI; tests/kavram-kaynaklari.js
-- bunu denetliyor.
--
-- Teste bağlı: tests/kavram-kaynaklari.js
-- ==========================================================================

create or replace function public.concept_study_sources(p_concepts text[])
returns table (
  istenen       text,
  concept_label text,
  study_card_id uuid,
  document_id   uuid,
  file_name     text,
  course_tag    text,
  source        text,
  match_kind    text
)
language sql
stable
as $$
  with istek as (
    select distinct
           c                                as istenen,
           public.concept_key_of(c)         as k
      from unnest(coalesce(p_concepts, '{}'::text[])) c
     where public.concept_key_of(c) is not null
  ),
  eslesme as (
    select i.istenen, u.concept_label, u.study_card_id, u.document_id,
           u.course_tag, u.source,
           case when u.concept_key = i.k then 'exact' else 'contains' end as match_kind
      from istek i
           join public.user_concept_index u
             on u.user_id = auth.uid()
            and (u.concept_key = i.k
                 or u.concept_key like '%' || i.k || '%'
                 or i.k like '%' || u.concept_key || '%')
  )
  select e.istenen, e.concept_label, e.study_card_id, e.document_id,
         d.file_name, e.course_tag, e.source, e.match_kind
    from eslesme e
    left join public.documents d on d.id = e.document_id
   order by e.istenen,
            (e.match_kind = 'exact') desc,
            (e.source = 'concept_graph') desc,
            d.file_name nulls last,
            e.concept_label
$$;

revoke all on function public.concept_study_sources(text[]) from public;
grant execute on function public.concept_study_sources(text[]) to authenticated, service_role;
