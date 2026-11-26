/* ==========================================================================
   ACADEX KIDS · KELİMEYE ÖZEL MİNİ HİKÂYE (kids/assets/kids-hikaye.js + kids-hikaye.css), 26.11.2026
   Sorun: İzle durağındaki mini hikâyede 17 konuda her kelime aynı kalıbı söylüyordu ("Look! A crab
   under the sea!", "Mmm! I like bread!") ve hepsi aynı eşyayla aynı hareketi yapıyordu. Hayvanlarda
   22.11'de çözülmüştü (HAYVAN_IS); burada geri kalan 15 konu aynı yapıya geçer.
   Her kelime: [eşya, davranış, cümle, efekt?]
     eşya    : sahneye gelen küçük çizim. Düz ad = kids-konusan ESYA / aşağıdaki ESYA2;
               'r:<id>' = kelime resmi (KIDS_RESIM, ör. r:moon), 's:<ad>' = arayüz simgesi (KIDS_CIZ)
     davranış: kn-hg-<davranış> (kids-hikaye.css + kids-canli.css): resim ve eşya birlikte oynar —
               yüzer, dalar, parlar, saklanır, erir, dökülür, keser, çizer, uçar, uyur…
     efekt   : hikâye başlarken çalan çizgi film sesi (fx:<id>, kids/ses/efektler.js; dosya yoksa
               kids-ses.js'teki sentez yedeği). Deniz canlılarının kendi sesi tanıtımda çalar.
   Cümleler okul öncesi düzeyde, kelimeye özgü ve bilgi veren; ses kataloğuna kendiliğinden girer
   (katalog KIDS_KONUSAN.replik'i dolaşır). tests/kids-hikaye.js: tekrar bekçisi + dilbilgisi.
   W.KIDS_HIKAYE = { al(konu, id), ESYA, GRUP, UCAN_GRUP }
   ========================================================================== */
(function (W) {
  'use strict';
  var H = {};
  function konu(k, l) { H[k] = H[k] || {}; l.forEach(function (x) { H[k][x[0]] = { e: x[1], g: x[2], c: x[3], fx: x[4] || null }; }); }

  /* ---------------- deniz: her canlının kendi işi ---------------- */
  konu('sea', [
    ['whale', 'damla', 'puskur', 'The whale sprays water up high! Whoosh!'],
    ['dolphin', 'dalga', 'atla', 'The dolphin jumps over the waves!'],
    ['octopus', 'murekkep', 'saklan', 'The octopus hides in a cloud of ink!'],
    ['crab', 'kum', 'yan', 'The crab walks sideways on the sand!'],
    ['turtle', 'kabarcik', 'saklan', 'The turtle hides in its shell! Peekaboo!'],
    ['starfish', 'pirilti', 'don', 'The starfish spins like a little star!'],
    ['shark', 'hiz', 'hizli', 'The shark swims super fast! Zoom!'],
    ['jellyfish', 'pirilti', 'parla', 'The jellyfish glows in the dark sea!'],
    ['seahorse', 'dalga', 'zipla', 'The seahorse bobs up and down!'],
    ['shell', 'inci', 'gel', 'Look inside the shell! A shiny pearl!'],
    ['seal', 'top', 'oyun', 'The seal plays with a ball on its nose!'],
    ['squid', 'murekkep', 'hizli', 'The squid squirts ink and zooms away!'],
    ['lobster', 'kum', 'kes', 'The lobster snaps its big claws! Snap, snap!'],
    ['coral', 'r:fish', 'etraf', 'Little fish swim around the coral!'],
    ['seaweed', 'dalga', 'sallan', 'The seaweed waves in the water!'],
    ['stingray', 'kum', 'suzul', 'The stingray glides over the sand like a kite!'],
    ['swordfish', 'buyutec', 'bak', 'Look! The swordfish has a long, pointy nose!'],
    ['clownfish', 'ot', 'saklan', 'The clownfish plays hide-and-seek in the seaweed!'],
    ['pufferfish', 'kabarcik', 'buyu', 'The pufferfish puffs up like a ball!'],
    ['eel', 'kivilcim', 'titre', 'The eel wiggles and wiggles! Zzzap!'],
    ['walrus', 'zzz', 'uyu', 'The walrus naps on the ice! Snore!'],
    ['anchor', 'kabarcik', 'dal', 'Splash! The anchor sinks down, down, down!']
  ]);
  /* ---------------- yiyecek ---------------- */
  konu('food', [
    ['apple', 'yaprak', 'dus', 'The apple falls from the tree! Bonk!'],
    ['banana', 'pirilti', 'isir', 'Peel the banana and take a bite! Yum!'],
    ['bread', 'buhar', 'buhar', 'Warm bread from the oven! Smell it!'],
    ['milk', 'damla', 'dok', 'Pour the milk into a cup! Glug, glug!'],
    ['egg', 'pirilti', 'kir', 'Crack! The egg breaks open!'],
    ['cake', 'yangin', 'parla', 'Make a wish and blow out the candles!'],
    ['cheese', 'r:mouse', 'gel', 'A little mouse comes for the cheese!'],
    ['carrot', 'pirilti', 'isir', 'Crunch, crunch! Carrots help you see!'],
    ['strawberry', 'yaprak', 'zipla', 'A sweet red strawberry from the garden!'],
    ['juice', 'damla', 'dok', 'Squeeze the fruit and make juice!'],
    ['pizza', 'buhar', 'buhar', 'Hot pizza with lots of cheese! Careful!'],
    ['sandwich', 'pirilti', 'buyu', 'A big sandwich! Can you open your mouth wide?'],
    ['soup', 'buhar', 'buhar', 'Blow on the soup. It\'s hot! Phew!'],
    ['rice', 'pirilti', 'isir', 'Rice with a spoon, one big bite!'],
    ['cookie', 'pirilti', 'kir', 'Crunch! Cookie crumbs everywhere!'],
    ['icecream', 'damla', 'eri', 'Lick it fast! The ice cream is melting!'],
    ['chicken', 'buhar', 'buhar', 'Chicken for dinner! It smells so good!'],
    ['pasta', 'pirilti', 'don', 'Twirl the pasta round and round!'],
    ['honey', 'damla', 'dok', 'Drip, drop! Sweet honey from the bees!'],
    ['chocolate', 'gunes', 'eri', 'Oh no! The chocolate melts in the sun!'],
    ['burger', 'pirilti', 'buyu', 'A tall burger! Bread, cheese and more!'],
    ['chips', 'pirilti', 'isir', 'Crispy chips! Crunch, crunch!'],
    ['salad', 'yaprak', 'don', 'Mix the salad! Green and good for you!'],
    ['tomato', 'yaprak', 'zipla', 'A round red tomato! So squishy!'],
    ['potato', 'camur', 'cik', 'Dig, dig! Potatoes grow under the ground!'],
    ['corn', 'gunes', 'parla', 'Yellow corn grows tall in the sun!'],
    ['pancake', 'pirilti', 'atla', 'Flip the pancake! Up, up and catch!'],
    ['yoghurt', 'kar', 'titre', 'Cold yoghurt with a spoon! Brr, yum!'],
    ['popcorn', 'pirilti', 'zipla', 'Pop, pop, pop! The popcorn jumps!'],
    ['sweets', 'dis', 'gel', 'Just one sweet, then brush your teeth!'],
    ['lollipop', 'pirilti', 'don', 'Lick the lollipop! It\'s a sweet swirl!'],
    ['sausage', 'buhar', 'titre', 'Sizzle, sizzle! Sausages in the pan!']
  ]);
  /* ---------------- meyveler ---------------- */
  konu('fruits', [
    ['orangefruit', 'pirilti', 'don', 'Peel the orange! It smells so fresh!'],
    ['grapes', 'pirilti', 'zipla', 'Pop the grapes in your mouth, one by one!'],
    ['pear', 'yaprak', 'sallan', 'A green pear hangs on the tree!'],
    ['lemon', 'damla', 'dok', 'Squeeze the lemons and make lemonade!'],
    ['watermelon', 'pirilti', 'kir', 'Crack! Green outside, red inside!'],
    ['cherries', 'r:cake', 'gel', 'Two cherries on top of the cake!'],
    ['pineapple', 's:tac', 'gel', 'The pineapple wears a spiky green crown!'],
    ['peach', 'pirilti', 'buyu', 'A soft, fuzzy peach! So sweet!'],
    ['kiwi', 'tohum', 'kes', 'Cut the kiwi! Green with tiny black seeds!'],
    ['mango', 'gunes', 'parla', 'A sunny yellow mango! So juicy!'],
    ['plum', 'pirilti', 'zipla', 'A little purple plum bounces! Boing!'],
    ['apricot', 'gunes', 'gel', 'Little orange apricots dry in the sun!'],
    ['fig', 'tohum', 'kes', 'Open the fig! It has lots of tiny seeds!'],
    ['melon', 'pirilti', 'titre', 'Knock, knock on the melon! Is it ready?'],
    ['raspberry', 'pirilti', 'gel', 'A raspberry on my finger, like a little hat!'],
    ['blueberries', 'pirilti', 'zipla', 'Count the blueberries! One, two, three!'],
    ['coconut', 'yaprak', 'dus', 'Bonk! A coconut falls from the palm tree!'],
    ['avocado', 'pirilti', 'kes', 'Cut the avocado! It has a big seed inside!'],
    ['pomegranate', 'pirilti', 'kir', 'Open the pomegranate! Lots of red jewels!'],
    ['lime', 'pirilti', 'titre', 'A little green lime! Sour, sour, sour!'],
    ['tangerine', 'pirilti', 'zipla', 'A tangerine is easy to peel!'],
    ['quince', 'buhar', 'buhar', 'Grandma cooks quince with sugar! Yum!']
  ]);
  /* ---------------- vücut ---------------- */
  konu('body', [
    ['head', 's:sapka', 'gel', 'I put a hat on my head!'],
    ['eyes', 's:gozluk', 'gel', 'I see with my eyes! Blink, blink!'],
    ['ears', 'nota', 'ses', 'I hear music with my ears!'],
    ['nose', 'cicek', 'gel', 'Sniff, sniff! I smell a flower with my nose!'],
    ['mouth', 'pirilti', 'buyu', 'Open your mouth and say aah!'],
    ['hands', 'kabarcik', 'yika', 'Wash your hands with soap and water!'],
    ['hair', 'tarak', 'sallan', 'Brush your hair, swish, swish!'],
    ['feet', 'top', 'oyun', 'Kick the ball with your feet!'],
    ['arms', 'kalp', 'kalp', 'Open your arms for a big hug!'],
    ['legs', 'hiz', 'hizli', 'My legs can run so fast!'],
    ['face', 'r:mirror', 'gel', 'Look in the mirror and smile!'],
    ['fingers', 'pirilti', 'zipla', 'One, two, three, four, five fingers!'],
    ['toes', 'kum', 'titre', 'Wiggle your toes in the sand!'],
    ['teeth', 'dis', 'yika', 'Brush your teeth, up and down!'],
    ['tongue', 'r:icecream', 'gel', 'Stick out your tongue and lick the ice cream!'],
    ['neck', 'yaprak', 'buyu', 'The giraffe has a long neck to reach the leaves!'],
    ['shoulders', 'pirilti', 'zipla', 'Shrug your shoulders! I don\'t know!'],
    ['knees', 'yarabandi', 'gel', 'Oops! A bandage for my knee!'],
    ['tummy', 'r:bread', 'titre', 'My tummy says rumble, rumble! I\'m hungry!'],
    ['cheeks', 'pirilti', 'parla', 'My cheeks go pink when I laugh!'],
    ['chin', 'pirilti', 'sallan', 'Hmm! I tap my chin and think!'],
    ['eyebrows', 'pirilti', 'zipla', 'Up go my eyebrows! What a surprise!'],
    ['lips', 'kalp', 'kalp', 'Pucker your lips and blow a kiss!'],
    ['thumb', 'pirilti', 'buyu', 'Thumbs up! Good job!'],
    ['nails', 'r:scissors', 'kes', 'Snip! Keep your nails short and clean!'],
    ['elbow', 'pirilti', 'sallan', 'Bend your elbow, up and down!'],
    ['back', 'r:bag', 'gel', 'I carry my bag on my back!']
  ]);
  /* ---------------- oyuncaklar ---------------- */
  konu('toys', [
    ['ball', 'pirilti', 'zipla', 'Bounce the ball! Boing, boing, boing!', 'ball'],
    ['car', 'bayrak', 'hizli', 'Vroom! The toy car wins the race!', 'car'],
    ['teddy', 'kalp', 'kalp', 'Give your teddy a big hug!'],
    ['doll', 's:fiyonk', 'gel', 'The doll has a pretty pink bow!'],
    ['kite', 'r:cloud', 'uc', 'The kite flies high in the windy sky!'],
    ['blocks', 'pirilti', 'dus', 'Build a tall tower! Oops, it falls down!'],
    ['train', 'buhar', 'buhar', 'Choo-choo! All aboard the toy train!', 'train'],
    ['robot', 'kivilcim', 'titre', 'Beep, boop! The robot does a robot dance!', 'robot'],
    ['drum', 'nota', 'ses', 'Boom, boom, boom! Play the drum!', 'drum'],
    ['balloon', 'r:cloud', 'uc', 'Hold on tight! The balloon floats away!', 'balloon'],
    ['puzzle', 'pirilti', 'gel', 'Find the last piece! The puzzle is finished!'],
    ['yoyo', 'pirilti', 'dal', 'Down and up goes the yo-yo!', 'yoyo'],
    ['dinosaur', 'kukre', 'titre', 'Roar! The little dinosaur stomps around!', 'dinosaur'],
    ['bubbles', 'kabarcik', 'yika', 'Blow bubbles! Pop, pop, pop!', 'bubbles'],
    ['skateboard', 'hiz', 'hizli', 'Whee! Roll down the hill on the skateboard!'],
    ['dice', 'pirilti', 'don', 'Roll the dice! What number is it?', 'dice'],
    ['marbles', 'pirilti', 'yan', 'Clink, clink! The marbles roll and bump!', 'marbles'],
    ['piano', 'nota', 'ses', 'Play the piano! Do, re, mi!', 'piano'],
    ['whistle', 'nota', 'ses', 'Tweet! Blow the whistle and start the game!', 'whistle'],
    ['puppet', 'kalp', 'sallan', 'The puppet waves hello to you!'],
    ['spintop', 'pirilti', 'don', 'Spin, spin, spin! The top goes round!', 'spintop'],
    ['swing', 'r:cloud', 'sallan', 'Swing high, up to the sky and back!'],
    ['slide', 'pirilti', 'suzul', 'Wheee! Down the slide we go!'],
    ['bucket', 'kum', 'gel', 'Fill the bucket with sand and make a castle!'],
    ['rockinghorse', 'pirilti', 'sallan', 'Giddy-up! Rock, rock, rock!', 'rockinghorse'],
    ['toyboat', 'dalga', 'sallan', 'The little boat floats in the bath!'],
    ['xylophone', 'nota', 'ses', 'Ding, ding, ding! Tap the xylophone!', 'xylophone'],
    ['guitar', 'nota', 'ses', 'Strum the guitar and sing a song!', 'guitar'],
    ['trumpet', 'nota', 'ses', 'Toot, toot! Blow the trumpet loud!', 'trumpet'],
    ['rope', 'pirilti', 'atla', 'Jump over the rope! One, two, three!']
  ]);
  /* ---------------- taşıtlar (efekt: kendi motoru / sireni / düdüğü) ---------------- */
  konu('transport', [
    ['bus', 'durak', 'sur', 'The bus stops and everybody gets on!', 'bus'],
    ['plane', 'r:cloud', 'uc', 'The plane flies above the clouds!', 'plane'],
    ['ship', 'dalga', 'sallan', 'The big ship sails across the sea!', 'ship'],
    ['bike', 'cicek', 'sur', 'Ring, ring! Ride your bike to the park!', 'bike'],
    ['helicopter', 'r:cloud', 'cik', 'The helicopter goes straight up!', 'helicopter'],
    ['taxi', 's:ev', 'gel', 'Taxi! Please take me home!', 'taxi'],
    ['tractor', 'camur', 'sur', 'The tractor drives through the muddy field!', 'tractor'],
    ['truck', 'koli', 'sur', 'The big truck carries lots of boxes!', 'truck'],
    ['rocket', 'r:moon', 'uc', 'Three, two, one! The rocket blasts off to the moon!', 'rocket'],
    ['motorbike', 'hiz', 'hizli', 'Vroom, vroom! The motorbike is very fast!', 'motorbike'],
    ['ambulance', 'yarabandi', 'hizli', 'Nee-naw! The ambulance hurries to help!', 'ambulance'],
    ['fireengine', 'yangin', 'puskur', 'The fire engine sprays water on the fire!', 'fireengine'],
    ['policecar', 'pirilti', 'parla', 'Wee-woo! The police car lights flash blue!', 'policecar'],
    ['scooter', 'pirilti', 'suzul', 'Push, push and glide! Ride the scooter!', 'scooter'],
    ['submarine', 'kabarcik', 'dal', 'The submarine dives deep under the sea!', 'submarine'],
    ['hotairballoon', 'yangin', 'uc', 'Whoosh! Hot air lifts the balloon up!', 'hotairballoon'],
    ['tram', 'pirilti', 'sur', 'Clang, clang! The tram rolls along the track!', 'tram'],
    ['van', 'koli', 'gel', 'The van brings a big parcel to our door!', 'van'],
    ['sailboat', 'dalga', 'suzul', 'The wind blows the sail! Off we go!', 'sailboat'],
    ['canoe', 'damla', 'sallan', 'Paddle, paddle! The canoe goes down the river!', 'canoe'],
    ['jeep', 'camur', 'zipla', 'The jeep bumps over the rocks! Bumpy, bumpy!', 'jeep'],
    ['digger', 'kum', 'dal', 'The digger digs a big hole! Scoop!', 'digger']
  ]);
  /* ---------------- meslekler ---------------- */
  konu('jobs', [
    ['doctor', 'kalp', 'kalp', 'The doctor listens to your heart! Thump, thump!'],
    ['teacher', 'r:book', 'gel', 'The teacher reads us a story!'],
    ['chef', 'buhar', 'buhar', 'The chef cooks yummy soup in the kitchen!'],
    ['firefighter', 'yangin', 'puskur', 'The firefighter puts out the fire! Splash!'],
    ['police', 'r:policecar', 'gel', 'The police officer helps us cross the road!'],
    ['farmer', 'r:carrot', 'cik', 'The farmer grows carrots in the field!'],
    ['pilot', 'r:plane', 'uc', 'The pilot flies the plane up high!'],
    ['builder', 'cekic', 'titre', 'Bang, bang! The builder builds a house!'],
    ['nurse', 'yarabandi', 'gel', 'The nurse puts a bandage on my arm!'],
    ['vet', 'kemik', 'kalp', 'The vet makes the puppy feel better!'],
    ['dentist', 'dis', 'parla', 'The dentist says open wide! Shiny teeth!'],
    ['artist', 'kagit', 'ciz', 'The artist paints a colourful picture!'],
    ['singer', 'nota', 'ses', 'The singer sings a happy song! La, la, la!'],
    ['postman', 'mektup', 'gel', 'The postman brings a letter for you!'],
    ['mechanic', 'r:car', 'gel', 'The mechanic fixes the broken car!'],
    ['scientist', 'kabarcik', 'buyu', 'The scientist mixes colours! Fizz, bubble, pop!'],
    ['astronaut', 'r:moon', 'uc', 'The astronaut flies all the way to the moon!'],
    ['waiter', 'r:cake', 'gel', 'The waiter brings us cake! Thank you!'],
    ['baker', 'r:bread', 'buhar', 'The baker bakes fresh bread every morning!'],
    ['hairdresser', 'r:scissors', 'kes', 'Snip, snip! The hairdresser cuts my hair!'],
    ['driver', 'durak', 'sur', 'The bus driver stops at every stop!'],
    ['gardener', 'cicek', 'cik', 'The gardener plants seeds and flowers grow!']
  ]);
  /* ---------------- giysiler (havaya göre) ---------------- */
  konu('clothes', [
    ['hat', 'gunes', 'gel', 'Wear a hat in the hot sun!'],
    ['tshirt', 'gunes', 'zipla', 'A T-shirt for a sunny day!'],
    ['dress', 'pirilti', 'don', 'Twirl around in your pretty dress!'],
    ['shoes', 'hiz', 'hizli', 'Put on your shoes and run outside!'],
    ['socks', 'kar', 'titre', 'Warm socks for cold toes!'],
    ['coat', 'kar', 'yagis', 'Put on your coat! It\'s snowing!'],
    ['scarf', 'kar', 'sallan', 'Wrap your scarf around your neck! Brr!'],
    ['gloves', 'kar', 'gel', 'Gloves keep your fingers warm in the snow!'],
    ['trousers', 'pirilti', 'zipla', 'One leg, two legs! Put on your trousers!'],
    ['boots', 'su', 'atla', 'Splash! Jump in the puddles with your boots!'],
    ['skirt', 'pirilti', 'sallan', 'Swish, swish goes my skirt!'],
    ['shorts', 'gunes', 'parla', 'It\'s very hot! Wear your shorts!'],
    ['jacket', 'r:cloud', 'sallan', 'It\'s windy! Zip up your jacket!'],
    ['sweater', 'kar', 'buyu', 'A cosy sweater! So warm and soft!'],
    ['pyjamas', 'zzz', 'uyu', 'Pyjamas on! It\'s time for bed!'],
    ['cap', 'top', 'oyun', 'Wear your cap and play ball!'],
    ['sunglasses', 'gunes', 'parla', 'Cool sunglasses for the bright sun!'],
    ['belt', 'pirilti', 'gel', 'The trousers are too big! Use a belt!'],
    ['sandals', 'kum', 'gel', 'Sandals for walking on the beach!'],
    ['swimsuit', 'dalga', 'dal', 'Put on your swimsuit and jump in! Splash!'],
    ['shirt', 'pirilti', 'gel', 'Button up your shirt, one, two, three!'],
    ['jeans', 'pirilti', 'zipla', 'Blue jeans for playing outside!'],
    ['raincoat', 'yagmur', 'yagis', 'Rain, rain! Wear your raincoat!'],
    ['slippers', 'zzz', 'suzul', 'Soft slippers for inside the house!'],
    ['tie', 'pirilti', 'sallan', 'Dad wears a tie to work!'],
    ['watch', 'pirilti', 'don', 'Tick, tock! What time is it?'],
    ['necklace', 'inci', 'parla', 'A shiny necklace for the party!'],
    ['helmet', 'hiz', 'hizli', 'Wear a helmet when you ride your bike!'],
    ['apron', 'buhar', 'buhar', 'Put on an apron! Let\'s cook!'],
    ['ribbon', 'kalp', 'sallan', 'A pretty ribbon in my hair!']
  ]);
  /* ---------------- ev ---------------- */
  konu('home', [
    ['bed', 'zzz', 'uyu', 'Jump into bed! Good night!'],
    ['sofa', 'kalp', 'zipla', 'Sit on the soft sofa! Boing!'],
    ['table', 'r:cake', 'gel', 'Put the cake on the table! Dinner time!'],
    ['chair', 'pirilti', 'dal', 'Sit down on the chair, please!'],
    ['bath', 'kabarcik', 'yika', 'Splish, splash! Bubbles in the bath!'],
    ['lamp', 'pirilti', 'parla', 'Click! Turn on the lamp! Now it\'s bright!'],
    ['fridge', 'kar', 'titre', 'Brr! It\'s cold inside the fridge!'],
    ['door', 'r:key', 'gel', 'Knock, knock! Who is at the door?'],
    ['window', 'gunes', 'parla', 'Open the window! Hello, sunshine!'],
    ['clock', 'pirilti', 'sallan', 'Tick, tock goes the clock!'],
    ['tv', 'pirilti', 'parla', 'Let\'s watch cartoons on TV!'],
    ['mirror', 'pirilti', 'zipla', 'Look in the mirror! Who is that? It\'s me!'],
    ['shower', 'damla', 'yagis', 'Drip, drop! Wash in the shower!'],
    ['sink', 'kabarcik', 'yika', 'Wash your hands in the sink!'],
    ['cooker', 'buhar', 'buhar', 'Mum cooks soup on the cooker! Careful, hot!'],
    ['wardrobe', 'pirilti', 'saklan', 'Peekaboo! I hide in the wardrobe!'],
    ['carpet', 'pirilti', 'suzul', 'A soft carpet! Let\'s sit and play!'],
    ['stairs', 'pirilti', 'cik', 'Up the stairs, one step at a time!'],
    ['plant', 'damla', 'cik', 'Water the plant and watch it grow!'],
    ['pillow', 'pirilti', 'zipla', 'Pillow fight! Bop, bop!'],
    ['kitchen', 'buhar', 'buhar', 'Something smells good in the kitchen!'],
    ['bathroom', 'dis', 'yika', 'Brush your teeth in the bathroom!'],
    ['bedroom', 'top', 'gel', 'This is my bedroom! My toys live here!'],
    ['livingroom', 'kalp', 'kalp', 'The family sits together in the living room!'],
    ['garden', 'cicek', 'cik', 'Flowers grow in the garden!'],
    ['roof', 'nota', 'ses', 'A little bird sings on the roof! Tweet!'],
    ['key', 'pirilti', 'don', 'Turn the key! Click! The door opens!'],
    ['phone', 'nota', 'titre', 'Ring, ring! Hello, Grandma!'],
    ['shelf', 'r:book', 'gel', 'Put the books back on the shelf!'],
    ['curtains', 'gunes', 'sallan', 'Open the curtains! Good morning!']
  ]);
  /* ---------------- okul ---------------- */
  konu('school', [
    ['pencil', 'kagit', 'ciz', 'Draw a line with your pencil!'],
    ['book', 'pirilti', 'buyu', 'Open the book! Once upon a time…'],
    ['bag', 'r:book', 'gel', 'Put your books in your school bag!'],
    ['crayons', 'kagit', 'ciz', 'Colour a rainbow with your crayons!'],
    ['scissors', 'kagit', 'kes', 'Snip, snip! Cut the paper carefully!'],
    ['glue', 'kagit', 'gel', 'Stick it with glue! Press, press!'],
    ['ruler', 'kagit', 'gel', 'How long is it? Measure it with the ruler!'],
    ['eraser', 'kagit', 'titre', 'Oops! Rub it out with the eraser!'],
    ['desk', 'r:book', 'gel', 'Sit at your desk and open your book!'],
    ['board', 'kagit', 'ciz', 'The teacher writes on the board!'],
    ['notebook', 'kagit', 'ciz', 'Write your name in your notebook!'],
    ['pen', 'mektup', 'gel', 'Write a letter with your pen!'],
    ['sharpener', 'pirilti', 'don', 'Twist, twist! Sharpen your pencil!'],
    ['chalk', 'kagit', 'ciz', 'Draw a hopscotch on the ground with chalk!'],
    ['paints', 'gunes', 'gel', 'Splish, splash! Paint a big yellow sun!'],
    ['globe', 'pirilti', 'don', 'Spin the globe! Where is Turkey?'],
    ['computer', 'pirilti', 'parla', 'Click, click! Play a game on the computer!'],
    ['lunchbox', 'r:apple', 'gel', 'Open your lunchbox! An apple for you!'],
    ['stapler', 'kagit', 'titre', 'Click! Staple the papers together!'],
    ['paper', 'r:plane', 'uc', 'Fold the paper and make a plane!'],
    ['pencilcase', 'pirilti', 'saklan', 'The pencils hide in the pencil case!'],
    ['marker', 'kagit', 'ciz', 'Draw a big smile with the marker!'],
    ['map', 'buyutec', 'bak', 'Look at the map! Where is the treasure?'],
    ['calculator', 'pirilti', 'zipla', 'One plus one is two!'],
    ['bell', 'nota', 'ses', 'Ding, dong! The bell rings! Playtime!', 'bell'],
    ['playground', 'top', 'oyun', 'Run and play on the playground!'],
    ['classroom', 'kalp', 'kalp', 'Good morning, everyone! Welcome to class!'],
    ['tape', 'kagit', 'gel', 'Stick the picture on the wall with tape!'],
    ['sticker', 'pirilti', 'parla', 'A gold star sticker! Well done!'],
    ['magnifier', 'sinek', 'gel', 'Look closer! A tiny bug!']
  ]);
  /* ---------------- duygular ---------------- */
  konu('feelings', [
    ['happy', 'gunes', 'zipla', 'I\'m so happy, I jump for joy!'],
    ['sad', 'yagmur', 'yagis', 'When I\'m sad, a hug helps!'],
    ['angry', 'buhar', 'titre', 'Grr! Take a deep breath, one, two, three!'],
    ['scared', 'pirilti', 'saklan', 'Hide under the blanket! It\'s just the wind!'],
    ['surprised', 'pirilti', 'buyu', 'Wow! A surprise! What is it?'],
    ['tired', 'zzz', 'uyu', 'Yawn! I\'m tired. Time for a nap!'],
    ['hungry', 'r:bread', 'titre', 'My tummy is rumbling! I\'m hungry!'],
    ['excited', 'pirilti', 'don', 'Yay! We\'re going to the park!'],
    ['shy', 'kalp', 'saklan', 'Peekaboo! I\'m a little bit shy!'],
    ['bored', 'pirilti', 'sallan', 'I\'m bored. Let\'s play a new game!'],
    ['proud', 's:tac', 'buyu', 'Look what I made! I\'m so proud!'],
    ['worried', 'kalp', 'titre', 'Don\'t worry! Everything will be OK!'],
    ['silly', 'pirilti', 'don', 'Let\'s make silly faces! Blah!'],
    ['brave', 'yildizlar', 'parla', 'I\'m brave! I\'m not afraid of the dark!'],
    ['loved', 'kalp', 'kalp', 'I love you so much!'],
    ['calm', 'dalga', 'suzul', 'Breathe in, breathe out. Nice and calm.'],
    ['nervous', 'pirilti', 'titre', 'My first day at school! I\'m a little nervous.'],
    ['sick', 'yarabandi', 'uyu', 'I feel sick. Rest in bed and get well soon!'],
    ['thirsty', 'damla', 'dok', 'I\'m thirsty! A glass of water, please!'],
    ['sleepy', 'r:moon', 'uyu', 'The moon is out. I\'m sleepy. Good night!'],
    ['lonely', 'kalp', 'gel', 'I\'m lonely. Will you play with me?'],
    ['confused', 'pirilti', 'sallan', 'Hmm? Which way? I\'m confused!'],
    ['curious', 'buyutec', 'bak', 'What\'s this? I\'m curious!'],
    ['grumpy', 'r:cloud', 'titre', 'Grumpy face! Who can make me smile?'],
    ['embarrassed', 'pirilti', 'parla', 'Oops! My cheeks are red!'],
    ['hurt', 'yarabandi', 'gel', 'Ouch! I hurt my knee. A bandage, please!']
  ]);
  /* ---------------- hareketler ---------------- */
  konu('actions', [
    ['run', 'hiz', 'hizli', 'Run, run, as fast as you can!'],
    ['jump', 'pirilti', 'zipla', 'Jump up high! One, two, three, jump!'],
    ['swim', 'su', 'su', 'Swim like a fish! Splash, splash!'],
    ['sing', 'nota', 'ses', 'La, la, la! Let\'s sing a song!'],
    ['dance', 'nota', 'don', 'Dance to the music and spin around!'],
    ['sleep', 'zzz', 'uyu', 'Shh! Close your eyes and sleep!'],
    ['eat', 'r:apple', 'gel', 'Eat your apple! Crunch!'],
    ['read', 'r:book', 'gel', 'Read a story with me!'],
    ['draw', 'kagit', 'ciz', 'Draw a big house with a pencil!'],
    ['climb', 'yaprak', 'cik', 'Climb up the tree, higher and higher!'],
    ['walk', 'pirilti', 'suzul', 'Walk to the park, step, step, step!'],
    ['sit', 'pirilti', 'dal', 'Sit down on the floor, please!'],
    ['stand', 'pirilti', 'cik', 'Stand up tall like a tree!'],
    ['clap', 'nota', 'zipla', 'Clap your hands! Clap, clap, clap!'],
    ['kick', 'top', 'oyun', 'Kick the ball into the goal!'],
    ['throw', 'top', 'atla', 'Throw the ball up high!'],
    ['catch', 'top', 'gel', 'Catch the ball! Got it!'],
    ['fly', 'r:cloud', 'uc', 'Flap your arms and fly like a bird!'],
    ['cry', 'damla', 'yagis', 'Don\'t cry! Here\'s a tissue!'],
    ['laugh', 'pirilti', 'titre', 'Ha, ha, ha! That\'s so funny!'],
    ['write', 'kagit', 'ciz', 'Write your name, A, B, C!'],
    ['cook', 'buhar', 'buhar', 'Stir the soup and cook dinner!'],
    ['wash', 'kabarcik', 'yika', 'Wash your face with soap and water!'],
    ['ride', 'hiz', 'sur', 'Ride your bike to the park!']
  ]);
  /* ---------------- renkler: her renk kendi nesnesiyle ---------------- */
  konu('colours', [
    ['red', 'r:apple', 'gel', 'Red like a shiny apple!'],
    ['yellow', 'gunes', 'parla', 'Yellow like the bright sun!'],
    ['blue', 'dalga', 'sallan', 'Blue like the big sea!'],
    ['green', 'ot', 'cik', 'Green like the grass in the garden!'],
    ['orange', 'r:carrot', 'gel', 'Orange like a crunchy carrot!'],
    ['purple', 'pirilti', 'don', 'Purple like sweet grapes!'],
    ['pink', 'cicek', 'gel', 'Pink like a pretty flower!'],
    ['brown', 'findik', 'gel', 'Brown like a little nut!'],
    ['black', 'yildizlar', 'parla', 'Black like the night sky!'],
    ['white', 'kar', 'yagis', 'White like the snow!'],
    ['grey', 'yagmur', 'sallan', 'Grey like a rainy cloud!']
  ]);
  /* ---------------- şekiller: gerçek nesneye dönüşür ---------------- */
  konu('shapes', [
    ['circle', 'top', 'gel', 'A circle is round like a ball!'],
    ['square', 'r:window', 'gel', 'This window is a square!'],
    ['triangle', 'yangin', 'gel', 'A tent is a triangle!'],
    ['star', 'yildizlar', 'parla', 'Twinkle, twinkle, little star!'],
    ['rectangle', 'r:door', 'gel', 'A door is a rectangle!'],
    ['heart', 'kalp', 'kalp', 'A heart says I love you!'],
    ['oval', 'r:egg', 'gel', 'An egg is an oval!'],
    ['diamond', 'pirilti', 'don', 'A diamond sparkles and shines!'],
    ['hexagon', 'bal', 'gel', 'Bees make hexagons in the honeycomb!'],
    ['pentagon', 'top', 'zipla', 'A football has pentagons on it!'],
    ['semicircle', 's:gokkusagi', 'parla', 'A rainbow is a semicircle!'],
    ['crescent', 'r:moon', 'parla', 'The moon is a crescent tonight!'],
    ['cube', 'pirilti', 'don', 'A dice is a cube! Roll it!'],
    ['cone', 'r:icecream', 'gel', 'An ice cream cone! Yum!'],
    ['cylinder', 'pirilti', 'yan', 'A can is a cylinder! Roll it along!'],
    ['arrow', 'hiz', 'hizli', 'Follow the arrow! This way!']
  ]);
  /* ---------------- aile ---------------- */
  konu('family', [
    ['mum', 'r:cake', 'gel', 'Mum bakes a cake with me!'],
    ['dad', 'top', 'oyun', 'Dad plays football with me!'],
    ['baby', 'zzz', 'uyu', 'Shh! The baby is sleeping!'],
    ['sister', 'pirilti', 'saklan', 'My sister and I play hide-and-seek!'],
    ['brother', 'pirilti', 'zipla', 'My brother can jump so high!'],
    ['grandma', 'r:cookie', 'gel', 'Grandma makes yummy cookies!'],
    ['grandpa', 'r:book', 'gel', 'Grandpa tells me a story!'],
    ['family', 'kalp', 'kalp', 'We love each other! We are a family!'],
    ['aunt', 'pirilti', 'buyu', 'My aunt brings me a present!'],
    ['uncle', 'r:kite', 'uc', 'My uncle flies a kite with me!'],
    ['boy', 'top', 'atla', 'The boy kicks the ball high!'],
    ['girl', 'hiz', 'sur', 'The girl rides her bike!'],
    ['man', 'r:book', 'gel', 'The man reads the newspaper!'],
    ['woman', 'cicek', 'gel', 'The woman waters the flowers!'],
    ['friend', 'kalp', 'zipla', 'Hello, friend! Let\'s play together!'],
    ['cousin', 'pirilti', 'zipla', 'My cousin comes to visit! Hooray!'],
    ['parents', 'kalp', 'buyu', 'Mum and Dad hold my hands!'],
    ['grandparents', 's:ev', 'gel', 'We visit Grandma and Grandpa!'],
    ['twins', 'pirilti', 'sallan', 'The twins look the same! Which is which?'],
    ['pet', 'kemik', 'yem', 'My pet dog loves his bone!'],
    ['me', 'pirilti', 'buyu', 'This is me! I\'m growing big!'],
    ['son', 'cicek', 'cik', 'The son helps his dad in the garden!'],
    ['daughter', 'r:book', 'gel', 'The daughter reads with her mum!'],
    ['children', 'nota', 'zipla', 'The children sing and play in the park!'],
    ['people', 'pirilti', 'sallan', 'So many people at the market!'],
    ['neighbour', 's:ev', 'gel', 'Hello, neighbour! Good morning!']
  ]);

  /* ---------------- yeni eşya çizimleri ---------------- */
  var M = '#23304D';
  function svg(ic, ek) { return '<svg viewBox="0 0 100 100"' + (ek || '') + ' class="kc" aria-hidden="true">' + ic + '</svg>'; }
  var ESYA = {
    dalga: svg('<path d="M0 46 q12.5 -18 25 0 t25 0 t25 0 t25 0 v54 h-100 z" fill="#4AA8FF" stroke="' + M + '" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round"/><path d="M0 64 q12.5 -12 25 0 t25 0 t25 0 t25 0 v36 h-100 z" fill="#2E7DD8"/><path d="M8 44 q6 -6 12 -2 M58 44 q6 -6 12 -2" fill="none" stroke="#fff" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linecap="round"/>', ' preserveAspectRatio="none"'),
    kum: svg('<path d="M4 86 q46 -14 92 0 v10 h-92z" fill="#F2D28A" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M30 80 v-22 h8 v-6 h6 v6 h12 v-6 h6 v6 h8 v22z" fill="#F7DFA0" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M50 52 v-14 l10 4 l-10 4" fill="#FF6B5B" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"/>'),
    murekkep: svg('<g fill="#3B2A63" stroke="' + M + '" stroke-width="3"><circle cx="40" cy="52" r="20"/><circle cx="62" cy="44" r="16"/><circle cx="60" cy="66" r="14"/><circle cx="28" cy="70" r="9"/></g><circle cx="34" cy="46" r="4" fill="#7A63B0"/>'),
    inci: svg('<path d="M14 62 a36 26 0 0 0 72 0 z" fill="#FFB3C7" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M26 66 l6 16 M40 66 l2 20 M60 66 l-2 20 M74 66 l-6 16" stroke="#F07AA0" stroke-width="3" stroke-linecap="round"/><path d="M14 58 a36 26 0 0 1 64 -26 z" fill="#FFC9D8" stroke="' + M + '" stroke-width="4" stroke-linejoin="round" transform="rotate(-18 14 58)"/><circle cx="50" cy="54" r="13" fill="#fff" stroke="' + M + '" stroke-width="3.5"/><circle cx="45" cy="49" r="4" fill="#E9F3FF"/><path d="M76 20 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 z" fill="#FFD23F" stroke="' + M + '" stroke-width="1.5"/>'),
    yangin: svg('<path d="M50 90 c-24 0 -32 -18 -26 -34 c4 10 12 12 12 12 c-4 -20 8 -36 20 -50 c0 14 14 22 18 36 c4 -6 4 -12 2 -16 c12 12 12 52 -26 52z" fill="#FF8A3D" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M50 88 c-10 0 -14 -8 -10 -16 c4 4 8 2 8 -6 c8 6 14 22 2 22z" fill="#FFD23F"/>'),
    dis: svg('<rect x="12" y="44" width="62" height="12" rx="6" fill="#4AA8FF" stroke="' + M + '" stroke-width="4"/><rect x="66" y="34" width="22" height="14" rx="3" fill="#fff" stroke="' + M + '" stroke-width="4"/><path d="M70 34 v-8 M76 34 v-10 M82 34 v-8" stroke="#BFE3FF" stroke-width="4" stroke-linecap="round"/>'),
    zzz: svg('<g font-family="Baloo 2,sans-serif" font-weight="800" fill="#8E7CF0" stroke="' + M + '" stroke-width="2"><text x="18" y="84" font-size="34">z</text><text x="46" y="60" font-size="28">z</text><text x="70" y="38" font-size="22">z</text></g>'),
    hiz: svg('<path d="M10 30 h44 M4 50 h60 M14 70 h40" stroke="' + M + '" stroke-width="6" stroke-linecap="round"/><path d="M10 30 h44 M4 50 h60 M14 70 h40" stroke="#BFE3FF" stroke-width="2.5" stroke-linecap="round"/>'),
    bayrak: svg('<path d="M24 92 V10" stroke="' + M + '" stroke-width="5" stroke-linecap="round"/><path d="M26 12 h54 v36 h-54z" fill="#fff" stroke="' + M + '" stroke-width="4"/><g fill="' + M + '"><rect x="26" y="12" width="13.5" height="12"/><rect x="53" y="12" width="13.5" height="12"/><rect x="39.5" y="24" width="13.5" height="12"/><rect x="66.5" y="24" width="13.5" height="12"/><rect x="26" y="36" width="13.5" height="12"/><rect x="53" y="36" width="13.5" height="12"/></g>'),
    buhar: svg('<path d="M30 88 c-10 -14 10 -22 0 -36 c-8 -12 8 -20 2 -32 M52 88 c-10 -14 10 -22 0 -36 c-8 -12 8 -20 2 -32 M74 88 c-10 -14 10 -22 0 -36 c-8 -12 8 -20 2 -32" fill="none" stroke="#C9D3EE" stroke-width="7" stroke-linecap="round"/>'),
    kar: svg('<g stroke="#7FC4FF" stroke-width="6" stroke-linecap="round"><path d="M50 12 V88 M17 31 L83 69 M17 69 L83 31"/><path d="M42 20 l8 8 l8 -8 M42 80 l8 -8 l8 8" fill="none"/></g><circle cx="50" cy="50" r="6" fill="#fff" stroke="' + M + '" stroke-width="3"/>'),
    yagmur: svg('<path d="M24 54 q-16 0 -16 -14 q0 -14 16 -14 q4 -18 24 -18 q18 0 24 14 q20 -2 20 16 q0 16 -18 16z" fill="#C9D3EE" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><g fill="#4AA8FF" stroke="' + M + '" stroke-width="2.5"><path d="M30 66 q-5 9 0 12 q5 -3 0 -12z"/><path d="M52 70 q-5 9 0 12 q5 -3 0 -12z"/><path d="M72 66 q-5 9 0 12 q5 -3 0 -12z"/></g>'),
    gunes: svg('<g stroke="#FFB020" stroke-width="6" stroke-linecap="round"><path d="M50 6 v12 M50 82 v12 M6 50 h12 M82 50 h12 M19 19 l8 8 M73 73 l8 8 M19 81 l8 -8 M73 27 l8 -8"/></g><circle cx="50" cy="50" r="22" fill="#FFD23F" stroke="' + M + '" stroke-width="4"/>'),
    kagit: svg('<path d="M14 16 h56 l16 16 v54 h-72z" fill="#fff" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M70 16 v16 h16" fill="none" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path class="kn-cizgi" d="M24 72 q10 -26 22 -10 q12 16 24 -14" fill="none" stroke="var(--r,#FF6B5B)" stroke-width="5" stroke-linecap="round"/>'),
    cekic: svg('<path d="M54 40 L22 88" stroke="#B07A40" stroke-width="10" stroke-linecap="round"/><path d="M54 40 L22 88" stroke="' + M + '" stroke-width="3" stroke-linecap="round" opacity=".4"/><rect x="40" y="14" width="44" height="22" rx="4" fill="#8E9BBF" stroke="' + M + '" stroke-width="4" transform="rotate(34 62 25)"/>'),
    yarabandi: svg('<rect x="8" y="36" width="84" height="28" rx="14" fill="#F2C9A0" stroke="' + M + '" stroke-width="4" transform="rotate(-20 50 50)"/><rect x="36" y="38" width="28" height="24" rx="4" fill="#FFE7CF" stroke="' + M + '" stroke-width="3" transform="rotate(-20 50 50)"/><g fill="#D9A070" transform="rotate(-20 50 50)"><circle cx="44" cy="46" r="2"/><circle cx="56" cy="46" r="2"/><circle cx="44" cy="54" r="2"/><circle cx="56" cy="54" r="2"/></g>'),
    mektup: svg('<rect x="10" y="26" width="80" height="52" rx="6" fill="#fff" stroke="' + M + '" stroke-width="4"/><path d="M12 30 l38 28 l38 -28" fill="none" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/><path d="M68 34 h14 v12 h-14z" fill="#FF6B5B" stroke="' + M + '" stroke-width="2.5"/>'),
    kivilcim: svg('<path d="M58 6 L26 54 h22 L38 94 L76 40 H52 L62 6z" fill="#FFD23F" stroke="' + M + '" stroke-width="4" stroke-linejoin="round"/>'),
    tarak: svg('<rect x="10" y="30" width="80" height="16" rx="6" fill="#FF8FB1" stroke="' + M + '" stroke-width="4"/><path d="M18 46 v24 M28 46 v24 M38 46 v24 M48 46 v24 M58 46 v24 M68 46 v24 M78 46 v24" stroke="' + M + '" stroke-width="4" stroke-linecap="round"/>'),
    durak: svg('<path d="M50 92 V40" stroke="' + M + '" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="28" r="22" fill="#4AA8FF" stroke="' + M + '" stroke-width="4"/><text x="50" y="37" text-anchor="middle" font-family="Baloo 2,sans-serif" font-weight="800" font-size="26" fill="#fff">B</text>'),
    koli: svg('<g stroke="' + M + '" stroke-width="4" stroke-linejoin="round"><rect x="10" y="50" width="38" height="36" fill="#D9A35E"/><rect x="52" y="50" width="38" height="36" fill="#C98A4B"/><rect x="30" y="16" width="38" height="34" fill="#E6B678"/></g><path d="M29 50 v12 M71 50 v12 M49 16 v12" stroke="#8A5A2A" stroke-width="4"/>'),
    yildizlar: svg('<g fill="#FFD23F" stroke="' + M + '" stroke-width="3" stroke-linejoin="round"><path d="M30 14 l5 12 l12 2 l-9 8 l3 12 l-11 -7 l-11 7 l3 -12 l-9 -8 l12 -2z"/><path d="M72 40 l4 9 l9 1 l-7 6 l2 9 l-8 -5 l-8 5 l2 -9 l-7 -6 l9 -1z"/><path d="M36 64 l4 9 l9 1 l-7 6 l2 9 l-8 -5 l-8 5 l2 -9 l-7 -6 l9 -1z"/></g>')
  };
  /* davranışlar (kids-hikaye.css); bunlarda eşyanın küçük kopyaları uçar ya da yağar */
  var GRUP = ['isir', 'dus', 'buhar', 'dok', 'kir', 'eri', 'parla', 'don', 'zipla', 'buyu', 'titre', 'uyu', 'gel', 'etraf', 'sallan', 'suzul', 'hizli', 'sur', 'uc', 'dal', 'atla', 'yan', 'saklan', 'bak', 'yika', 'kalp', 'cik', 'kes', 'ciz', 'yagis'];
  var UCAN_GRUP = { buhar: 1, uyu: 1, yika: 1, kalp: 1, dal: 1, dok: 1, eri: 1, yagis: 1 };
  function al(k, id) { return (H[k] && H[k][id]) || null; }
  W.KIDS_HIKAYE = { al: al, H: H, ESYA: ESYA, GRUP: GRUP, UCAN_GRUP: UCAN_GRUP };
})(window);
