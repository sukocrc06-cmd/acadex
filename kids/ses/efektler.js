/* ==========================================================================
   ACADEX KIDS · çizgi film ses efektleri (kids/ses/efektler.js), 13.11.2026
   Hayvanlar kendini tanıtmadan önce kendi sesini çıkarır. Bu sesler ElevenLabs'in
   "ses efekti" servisiyle (metinden efekt) bir kez üretilir:  node kids/ses/uret.js efekt
   Dosyalar kids/ses/fx/<id>.mp3; liste.json'a "fx:<id>" anahtarıyla yazılır.
   Dosya yoksa site tarayıcıda sentezlenen yedek efekti çalar (kids-ses.js HAYVAN).
   Bir sesi beğenmezsen metnini değiştir ve:  node kids/ses/uret.js efekt --hepsi
   ========================================================================== */
'use strict';
const STIL = ', cute cartoon style for a preschool children\'s animation, friendly and gentle, clean studio recording, no music, no background noise';
const e = (id, metin, sure) => ({ id, metin: metin + STIL, sure: sure || 1.5 });
module.exports = [
  e('cat', 'A kitten meowing twice, high and sweet'), e('dog', 'A small puppy barking twice, happy woof woof'), e('cow', 'A cow mooing once, long and soft', 2),
  e('sheep', 'A lamb bleating baa twice'), e('goat', 'A little goat bleating maa twice'), e('duck', 'A duck quacking three times'),
  e('bird', 'A small songbird tweeting a short happy melody'), e('chick', 'A baby chick cheeping quickly'), e('hen', 'A hen clucking, bok bok bok bokaak'),
  e('pig', 'A piglet oinking twice with a little snort'), e('lion', 'A young lion roaring once, playful not scary', 2), e('tiger', 'A tiger cub growling once, playful not scary', 2),
  e('bear', 'A bear cub growling softly, playful', 2), e('horse', 'A pony neighing once and snorting', 2), e('frog', 'A frog croaking ribbit twice'),
  e('monkey', 'A little monkey chattering ooh ooh aah aah', 2), e('elephant', 'A baby elephant trumpeting once', 2), e('mouse', 'A tiny mouse squeaking three times', 1),
  e('snake', 'A snake hissing softly once'), e('owl', 'An owl hooting twice, hoo hoo', 2), e('bee', 'A bumblebee buzzing around for a moment'),
  e('crocodile', 'A crocodile snapping its jaws twice, comic chomp chomp', 1), e('whale', 'A whale singing one gentle underwater call', 3), e('dolphin', 'A dolphin clicking and whistling happily', 2),
  e('seal', 'A seal barking twice, arf arf'), e('walrus', 'A walrus grunting once, deep and funny', 2),
  /* evcil hayvanım paneli */
  e('rabbit', 'A bunny making tiny sniffing and soft squeak sounds', 1), e('purr', 'A cat purring contentedly, close up', 2), e('munch', 'Comic crunchy eating sound, nom nom nom', 1.5),
  e('splash', 'Water splashing and bubbles popping in a bath, playful', 2), e('snore', 'A tiny cute snore with a soft whistle', 2)
];
