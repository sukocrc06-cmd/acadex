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
  e('splash', 'Water splashing and bubbles popping in a bath, playful', 2), e('snore', 'A tiny cute snore with a soft whistle', 2),
  /* 26.11.2026 deniz canlıları (İzle durağında kendini tanıtmadan önce) */
  e('octopus', 'An octopus making bubbly blub blub sounds underwater'), e('crab', 'A little crab clicking its claws, click clack click'), e('turtle', 'A sea turtle swimming slowly, gentle underwater bubbles', 2),
  e('starfish', 'A magical twinkle chime, like a sparkling star'), e('shark', 'A deep underwater swoosh as a fish swims past fast, not scary'), e('jellyfish', 'A wobbly jelly boing sound, soft and funny'),
  e('seahorse', 'Tiny squeaky bubbles popping, very small and cute', 1), e('shell', 'Soft ocean waves heard inside a seashell', 2), e('squid', 'A quick squirt of water and a whoosh', 1),
  e('lobster', 'Two loud claw snaps, snap snap', 1), e('coral', 'Little bubbles rising through water, gentle', 1.5), e('seaweed', 'Gentle underwater current, soft swish', 2),
  e('stingray', 'A smooth gliding swoosh through water', 1.5), e('swordfish', 'A fast whoosh through water like a sword', 1), e('clownfish', 'Playful bubble pops and a tiny giggle', 1.5),
  e('pufferfish', 'A balloon inflating quickly then a tiny pop', 1.5), e('eel', 'A comic electric zap with a buzz', 1), e('anchor', 'A metal chain rattling and a heavy splash into water', 2),
  /* taşıtlar: hikâyede (otobüs durur, itfaiye su sıkar…) */
  e('bus', 'A friendly bus horn, beep beep, and doors opening hiss', 2), e('plane', 'An airplane flying overhead, smooth jet whoosh', 2), e('ship', 'A big ship horn, long and low, toot', 2),
  e('bike', 'A bicycle bell ringing twice, ring ring', 1), e('helicopter', 'A helicopter rotor chop chop chop taking off', 2), e('taxi', 'A car horn honking twice, honk honk', 1),
  e('tractor', 'A tractor engine putt putt putt', 2), e('truck', 'A big truck engine rumbling and a short horn', 2), e('rocket', 'A rocket countdown rumble and blast off whoosh', 3),
  e('motorbike', 'A motorbike revving vroom vroom', 2), e('ambulance', 'An ambulance siren nee naw nee naw, short', 2), e('fireengine', 'A fire engine siren and water hose spraying', 2),
  e('policecar', 'A police car siren wee woo wee woo, short', 2), e('scooter', 'A kick scooter rolling on the pavement', 1.5), e('submarine', 'A submarine sonar ping ping underwater', 2),
  e('hotairballoon', 'A hot air balloon burner whooshing flame', 1.5), e('tram', 'A tram bell clang clang and wheels on rails', 2), e('van', 'A delivery van horn beep and engine', 1.5),
  e('sailboat', 'Wind filling a sail and gentle waves', 2), e('canoe', 'A paddle splashing in the water twice', 1.5), e('jeep', 'A jeep bumping over rocks, engine and bumps', 2),
  e('digger', 'A digger engine and a scoop of earth', 2),
  /* oyuncaklar ve okul zili */
  e('ball', 'A rubber ball bouncing three times, boing', 1.5), e('car', 'A toy car vroom with tiny wheels', 1.5), e('train', 'A toy train choo choo whistle and chugging', 2),
  e('robot', 'A toy robot beep boop with a whirring motor', 1.5), e('drum', 'A children\'s drum boom boom boom', 1.5), e('balloon', 'A balloon being let go, fluttering away', 1.5),
  e('yoyo', 'A yo-yo whirring down and up', 1), e('dinosaur', 'A cute baby dinosaur roar, silly not scary', 1.5), e('bubbles', 'Soap bubbles popping, pop pop pop', 1.5),
  e('dice', 'Dice rolling on a wooden table', 1), e('marbles', 'Glass marbles clinking together', 1), e('piano', 'A child playing do re mi on a piano', 2),
  e('whistle', 'A sports whistle, one short tweet', 1), e('spintop', 'A spinning top whirring', 1.5), e('rockinghorse', 'A wooden rocking horse creaking back and forth', 1.5),
  e('xylophone', 'A xylophone playing four rising notes', 1.5), e('guitar', 'An acoustic guitar strum, happy chord', 1.5), e('trumpet', 'A toy trumpet tooting twice', 1.5),
  e('bell', 'A school bell ringing ding dong', 1.5)
];
