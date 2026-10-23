/* Acadex · Masa manzarası
   Ana sayfadaki "Masana hoş geldin" bandını pencereli bir çalışma odasına çevirir:
   - pencerede seçilen şehrin silüeti (10 şehir, varsayılan Ankara)
   - şehrin gerçek gün doğumu/batımına göre otomatik sabah / öğle / akşam / gece
   - ahşap masa, ışık ve gölge, paralaks ve mikro animasyonlar
   Bağımsız dosyadır: kendi CSS'ini ekler, mevcut bant kodlarına dokunmaz. */
(function () {
  'use strict';
  if (window.__axMasa) return; window.__axMasa = 1;

  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  /* ------------------------------------------------------------------ CSS */
  var CSS = [
    '#home-view .band.axm{--a-txt:#fff;--a-txts:rgba(255,255,255,.78);--a-glow:rgba(4,8,30,.6);',
    '--a-frame:#2B3566;--a-frame-l:#3A4680;--a-frame-d:#1A2150;--a-wood:.6;--a-tint:rgba(16,24,72,.45);--a-cloud:#2A3A78;--a-cloud-o:.55;',
    '--a-b0:#1D2858;--a-b1:#172150;--a-lm:#141D49;--a-lmw:#24306A;--a-b2:#111A43;--a-b3:#0B1235;--a-wo:#1A2350;--a-lit:#FFD27A;',
    '--a-haze:#22347A;--a-haze-o:.55;--a-rim:#000;--a-riml:0;--a-rimr:0;--a-patch:#FFF2D6;--a-patch-o:0;--a-patch-x:40%;--a-shx:0px;--a-sho:.42;--a-screen:1;',
    '--a-sea:#0E1A4A;--a-seal:#FFD27A;--a-snow:#8F9BC8;--a-mev:#2D6B66;--a-scrim:rgba(5,10,40,.5);--desk-top:62%}',
    '#home-view .band.axm[data-axm=dawn]{--a-glow:rgba(60,30,80,.5);--a-frame:#7C6E8E;--a-frame-l:#9A8BAA;--a-frame-d:#5A4D6B;--a-wood:.86;--a-tint:rgba(255,150,140,.16);--a-cloud:#F6B6B0;--a-cloud-o:.85;',
    '--a-b0:#C2A5BD;--a-b1:#9580A6;--a-lm:#7D6A97;--a-lmw:#A08DB5;--a-b2:#615283;--a-b3:#3E355F;--a-wo:#6E5F8C;--a-lit:#FFC98A;--a-haze:#FFC9A0;--a-haze-o:.6;--a-rim:#FFC48E;--a-riml:.75;--a-rimr:0;',
    '--a-patch:#FFD0A0;--a-patch-o:.34;--a-patch-x:12%;--a-shx:14px;--a-sho:.36;--a-screen:0;--a-sea:#9A7AA3;--a-seal:#FFD7B0;--a-snow:#F3DDE8;--a-mev:#4F9486;--a-scrim:rgba(50,30,80,.35)}',
    '#home-view .band.axm[data-axm=day]{--a-txt:#0D1838;--a-txts:rgba(13,24,56,.75);--a-glow:rgba(255,255,255,.75);--a-frame:#F2EEE6;--a-frame-l:#fff;--a-frame-d:#CFC7B7;--a-wood:1;--a-tint:rgba(255,255,255,0);--a-cloud:#fff;--a-cloud-o:.95;',
    '--a-b0:#BDD1E8;--a-b1:#9CB6D8;--a-lm:#8AA6CC;--a-lmw:#C8D9EE;--a-b2:#7090BC;--a-b3:#56729E;--a-wo:#D6E7F8;--a-lit:#D6E7F8;--a-haze:#E4F3FF;--a-haze-o:.55;--a-rim:#fff;--a-riml:.18;--a-rimr:.18;',
    '--a-patch:#FFF6DA;--a-patch-o:.26;--a-patch-x:40%;--a-shx:0px;--a-sho:.34;--a-screen:0;--a-sea:#4A8ED2;--a-seal:#fff;--a-snow:#fff;--a-mev:#3AA58A;--a-scrim:rgba(255,255,255,.55)}',
    '#home-view .band.axm[data-axm=dusk]{--a-glow:rgba(60,20,40,.55);--a-frame:#6A4E66;--a-frame-l:#866480;--a-frame-d:#48324A;--a-wood:.78;--a-tint:rgba(255,120,60,.18);--a-cloud:#F59C7D;--a-cloud-o:.85;',
    '--a-b0:#97668C;--a-b1:#6E4C78;--a-lm:#5A3F68;--a-lmw:#8A6290;--a-b2:#432F57;--a-b3:#29203F;--a-wo:#4A3A5E;--a-lit:#FFC777;--a-haze:#FF9F6A;--a-haze-o:.5;--a-rim:#FFA86E;--a-riml:0;--a-rimr:.8;',
    '--a-patch:#FFB880;--a-patch-o:.4;--a-patch-x:64%;--a-shx:-16px;--a-sho:.4;--a-screen:.35;--a-sea:#7A4A78;--a-seal:#FFB27A;--a-snow:#F4C3B4;--a-mev:#457E70;--a-scrim:rgba(60,20,50,.35)}',

    /* eski bant öğeleri: manzara gelince gizlenir */
    '#home-view .band.axm>.sky,#home-view .band.axm .win,#home-view .band.axm .desk-items{display:none!important}',
    '#home-view .band.axm::before{display:none}',
    '#home-view .band.axm{background:#0A1330!important;overflow:hidden;isolation:isolate}',
    '#home-view .band.axm>.band-l,#home-view .band.axm>.band-r{position:relative;z-index:2}',
    '#home-view .band.axm .am-scene,#home-view .band.axm .am-scene *{transition:background-color 1.6s,color 1.6s,fill 1.6s,opacity 1.6s,filter 1.6s,stop-color 1.6s}',
    '#home-view .band.axm>.am-scene,.am-scene{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;container-type:inline-size}',
    '.am-view{position:absolute;left:0;right:0;top:0;height:var(--desk-top);overflow:hidden}',
    '.am-par{position:absolute;inset:0;will-change:transform}',
    '.am-sky{position:absolute;inset:-20px;opacity:0;transition:opacity 1.6s}',
    '.am-sky.dawn{background:linear-gradient(#2B3A78 0%,#7B5C9B 38%,#E58FA0 66%,#FFC58A 100%)}',
    '.am-sky.day{background:linear-gradient(#3C86E6 0%,#7DB8F5 45%,#BFE0FF 80%,#E4F3FF 100%)}',
    '.am-sky.dusk{background:linear-gradient(#232A64 0%,#6E3C78 36%,#D45E70 66%,#FF9F5C 100%)}',
    '.am-sky.night{background:linear-gradient(#060B26 0%,#0F1A4A 50%,#1F2F70 100%)}',
    '.axm[data-axm=dawn] .am-sky.dawn,.axm[data-axm=day] .am-sky.day,.axm[data-axm=dusk] .am-sky.dusk,.axm[data-axm=night] .am-sky.night{opacity:1}',
    '.am-stars{position:absolute;left:0;top:0;width:100%;height:65%;opacity:0}',
    '.axm[data-axm=night] .am-stars{opacity:1}.axm[data-axm=dawn] .am-stars{opacity:.25}',
    '.am-stars circle{fill:#fff;animation:amTw 4s ease-in-out infinite}@keyframes amTw{50%{opacity:.25}}',
    '.am-sun,.am-moon{position:absolute;border-radius:50%;opacity:0;transition:left 1.6s,top 1.6s,opacity 1.6s}',
    '.am-sun{width:70px;height:70px;left:56%;top:8%;background:radial-gradient(circle,#FFF8D6 0 46%,#FFE08A 60%,rgba(255,214,120,0) 72%);box-shadow:0 0 90px 40px rgba(255,214,140,.35)}',
    '.axm[data-axm=dawn] .am-sun{opacity:1;background:radial-gradient(circle,#FFE7C4 0 46%,#FFB58A 60%,rgba(255,170,120,0) 72%)}',
    '.axm[data-axm=day] .am-sun{opacity:1}',
    '.axm[data-axm=dusk] .am-sun{opacity:1;background:radial-gradient(circle,#FFE0B0 0 44%,#FF8E52 60%,rgba(255,120,60,0) 72%);box-shadow:0 0 120px 60px rgba(255,130,80,.35)}',
    '.am-moon{width:44px;height:44px;left:62%;top:12%;box-shadow:inset -12px 5px 0 0 #FFF6DC,0 0 46px 6px rgba(255,240,200,.18)}',
    '.axm[data-axm=night] .am-moon{opacity:1}',
    '.am-cl{position:absolute;opacity:var(--a-cloud-o);animation:amDrift linear infinite}.am-cl path{fill:var(--a-cloud)}',
    '.am-cl.a{top:14%;width:150px;animation-duration:140s;animation-delay:-40s}.am-cl.b{top:30%;width:96px;animation-duration:110s;animation-delay:-80s}.am-cl.c{top:6%;width:200px;animation-duration:180s;animation-delay:-10s}',
    '@keyframes amDrift{from{transform:translateX(-260px)}to{transform:translateX(calc(100cqi + 60px))}}',
    '.am-birds{position:absolute;left:0;top:26%;opacity:0;animation:amFly 38s linear infinite}.am-birds path{fill:none;stroke:#2C3E66;stroke-width:1.6;stroke-linecap:round}',
    '.axm[data-axm=day] .am-birds,.axm[data-axm=dawn] .am-birds{opacity:.7}',
    '@keyframes amFly{from{transform:translateX(-80px)}50%{transform:translateX(50cqi) translateY(-18px)}to{transform:translateX(calc(100cqi + 80px)) translateY(6px)}}',
    '.am-city{position:absolute;left:0;right:0;bottom:0;width:100%;height:82%;overflow:visible}',
    '.am-city .a-h0{fill:var(--a-b0)}.am-city .a-h1{fill:var(--a-b1)}.am-city .a-h2{fill:var(--a-b2)}.am-city .a-h3{fill:var(--a-b3)}',
    '.am-city .a-lm{fill:var(--a-lm)}.am-city .a-w{fill:var(--a-wo)}',
    '.axm[data-axm=night] .am-city .a-w.a-l1,.axm[data-axm=night] .am-city .a-w.a-l2,.axm[data-axm=dusk] .am-city .a-w.a-l1,.axm[data-axm=dawn] .am-city .a-w.a-l1{fill:var(--a-lit)}',
    '.axm[data-axm=day] .am-city .a-w{opacity:.55}',
    '.am-city .a-blink{animation:amBl 7s steps(1) infinite}@keyframes amBl{40%{fill:var(--a-wo)}}',
    '.am-city .a-rimL{fill:var(--a-rim);opacity:var(--a-riml)}.am-city .a-rimR{fill:var(--a-rim);opacity:var(--a-rimr)}',
    '.am-city .a-beacon{fill:#FF5A5A;opacity:0;animation:amBc 2.4s ease-in-out infinite}',
    '.axm[data-axm=night] .am-city .a-beacon,.axm[data-axm=dusk] .am-city .a-beacon{opacity:1}@keyframes amBc{50%{opacity:.15}}',
    '.am-city .am-hz stop{stop-color:var(--a-haze)}.am-city .a-hzr{opacity:var(--a-haze-o)}',
    '.am-city .a-lt{fill:var(--a-lmw)}.axm[data-axm=night] .am-city .a-lt,.axm[data-axm=dusk] .am-city .a-lt{fill:#FFE2A6}',
    '.am-city .a-lts{fill:none;stroke:#FFE2A6;stroke-width:1.6;opacity:0}.axm[data-axm=night] .am-city .a-lts{opacity:.9}.axm[data-axm=dusk] .am-city .a-lts{opacity:.45}',
    '.am-city .a-glowL{opacity:0}.axm[data-axm=night] .am-city .a-glowL{opacity:.8}',
    '.am-city .a-flag{fill:#E30A17;transform-box:fill-box;transform-origin:left center;animation:amWave 2.6s ease-in-out infinite}@keyframes amWave{50%{transform:skewY(6deg) scaleX(.92)}}',
    '.am-city .a-sea{fill:var(--a-sea)}.am-city .a-wave{fill:var(--a-seal);opacity:.45;transform-box:fill-box;animation:amShim 5s ease-in-out infinite}@keyframes amShim{50%{opacity:.08;transform:translateX(8px)}}',
    '.am-city .a-snow{fill:var(--a-snow)}.am-city .a-mev{fill:var(--a-mev)}.am-city .a-fl{fill:none;stroke:rgba(0,0,0,.2);stroke-width:1.4}',
    '.am-city .a-cable{fill:none;stroke:var(--a-lm);stroke-width:3}.am-city .a-hanger{fill:var(--a-lm);opacity:.75}',
    '.am-city .a-boat{transform-box:fill-box;animation:amBob 6s ease-in-out infinite}@keyframes amBob{50%{transform:translate(-10px,1.5px)}}',
    '.am-grain{position:absolute;inset:0;opacity:.2;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'180\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'.85\' numOctaves=\'2\' stitchTiles=\'stitch\'/><feColorMatrix values=\'0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .7 0\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\'/></svg>")}',
    '.am-glare{position:absolute;inset:0;background:linear-gradient(118deg,transparent 0 30%,rgba(255,255,255,.07) 34%,transparent 40%,transparent 62%,rgba(255,255,255,.05) 66%,transparent 70%)}',
    '.am-frame{position:absolute;inset:0;border:12px solid var(--a-frame);border-bottom:0;box-shadow:inset 0 0 0 2px var(--a-frame-d),inset 2px 2px 0 3px var(--a-frame-l),inset 0 22px 44px rgba(0,0,0,.2)}',
    '.am-mul{position:absolute;background:linear-gradient(90deg,var(--a-frame-d),var(--a-frame-l) 30%,var(--a-frame) 60%,var(--a-frame-d));box-shadow:3px 0 8px rgba(0,0,0,.18)}',
    '.am-mul.v1{top:0;bottom:0;left:calc(36% - 6px);width:12px}.am-mul.v2{top:0;bottom:0;left:calc(68% - 6px);width:12px}',
    '.am-mul.h{left:0;right:0;top:30%;height:10px;background:linear-gradient(var(--a-frame-l),var(--a-frame) 50%,var(--a-frame-d))}',
    '@container (max-width:760px){.am-mul.v2,.am-mul.h{display:none}.am-mul.v1{left:calc(64% - 6px)}}',
    '.am-desk{position:absolute;left:0;right:0;top:var(--desk-top);bottom:0}',
    '.am-wood{position:absolute;inset:0;background:repeating-linear-gradient(176deg,rgba(60,30,10,.08) 0 2px,transparent 2px 11px),repeating-linear-gradient(181deg,rgba(255,230,190,.06) 0 1px,transparent 1px 23px),linear-gradient(#CFA06C 0,#B9864F 70%,#A97644 100%);filter:brightness(var(--a-wood))}',
    '.am-wood::before{content:"";position:absolute;left:0;right:0;top:0;height:6px;background:linear-gradient(#E3BC8A,#B5824E);box-shadow:0 3px 10px rgba(0,0,0,.25)}',
    '.am-wood::after{content:"";position:absolute;inset:0;background:var(--a-tint);mix-blend-mode:multiply}',
    '.am-patch{position:absolute;top:0;left:var(--a-patch-x);width:38%;height:110px;opacity:var(--a-patch-o);mix-blend-mode:screen;background:linear-gradient(90deg,transparent 0,var(--a-patch) 8%,var(--a-patch) 45%,rgba(0,0,0,0) 46% 49%,var(--a-patch) 50%,var(--a-patch) 92%,transparent);clip-path:polygon(10% 0,90% 0,100% 100%,0 100%);filter:blur(3px);transition:left 1.6s,opacity 1.6s}',
    '.am-screen{position:absolute;left:0;right:0;top:-80px;height:240px;opacity:var(--a-screen);mix-blend-mode:screen;background:radial-gradient(50% 80% at 30% 100%,rgba(110,150,255,.3),transparent 70%)}',
    '.am-mug{position:absolute;width:76px;top:-64px;left:var(--mug-x,70%)}',
    '.am-mug .sh,.am-pencil .sh{position:absolute;left:2px;right:-6px;bottom:-6px;height:18px;border-radius:50%;background:radial-gradient(closest-side,rgba(30,14,0,var(--a-sho)),transparent);transform:translateX(var(--a-shx))}',
    '.am-mug svg{display:block;position:relative;transform-origin:50% 95%}',
    '.am-mug .st{transform-box:fill-box;transform-origin:50% 100%;transition:transform .5s ease-out}',
    '.am-mug .st path{fill:none;stroke:rgba(255,255,255,.75);stroke-width:2.2;stroke-linecap:round;animation:amSteam 3.4s ease-in-out infinite;opacity:0}',
    '.am-mug .st path:nth-child(2){animation-delay:1.1s}.am-mug .st path:nth-child(3){animation-delay:2.2s}',
    '@keyframes amSteam{0%{opacity:0;transform:translateY(8px)}30%{opacity:.8}100%{opacity:0;transform:translateY(-14px)}}',
    '.am-pencil{position:absolute;width:104px;top:-18px;left:var(--pen-x,60%)}.am-pencil svg{display:block;transform:rotate(-14deg)}',
    '.am-objdim .objs,.am-objdim .desk-empty,#home-view .band.am-objdim>.band-r{filter:brightness(calc(.4 + var(--a-wood) * .6))}',

    /* bant üzerindeki yazılar */
    '#home-view .band.axm .band-l>.eyb,#home-view .band.axm .band-l>.disp,#home-view .band.axm .band-l>.date{color:var(--a-txt)!important;text-shadow:0 1px 18px var(--a-glow),0 0 2px var(--a-glow)}',
    '#home-view .band.axm .band-l>.eyb,#home-view .band.axm .band-l>.date{color:var(--a-txts)!important}',
    '#home-view .band.axm .band-l .hint{text-shadow:0 1px 10px rgba(4,8,30,.8),0 0 2px rgba(4,8,30,.8)}',
    '#home-view .band.axm .go-row .ghost{color:#FFF6EA!important;text-shadow:0 1px 4px rgba(40,20,0,.55)}',
    /* seri paneli: duvar takvimi (spiralli, kırmızı başlıklı kâğıt) */
    '#home-view.axd .band.axm>.band-r{align-self:start;position:relative;background:linear-gradient(#FFFDF7,#F6F0E2);color:#1F2A4D;border:0;border-radius:3px 3px 6px 6px;padding:50px 24px 16px;transform:rotate(1.1deg);transform-origin:50% 0;-webkit-backdrop-filter:none;backdrop-filter:none;',
    'box-shadow:0 1px 0 #E8E1D2,0 3px 0 #F3EEE2,0 4px 0 #E1D8C6,0 6px 0 #F1EBDD,0 7px 0 #DCD2BE,0 26px 44px rgba(8,12,40,.38);transition:transform .5s cubic-bezier(.3,1.4,.5,1)}',
    '#home-view.axd .band.axm>.band-r:hover{transform:rotate(.4deg)}',
    '#home-view.axd .band.axm>.band-r::before{content:attr(data-am-month);position:absolute;left:0;right:0;top:0;height:34px;border-radius:3px 3px 0 0;background:radial-gradient(circle,#7E241C 0 3px,transparent 3.6px) 11px 6px/22px 10px repeat-x,linear-gradient(#D24B3C,#B93A2E);color:#fff;font:700 12px/40px "JetBrains Mono",monospace;letter-spacing:.32em;text-align:center;text-indent:.32em}',
    '#home-view.axd .band.axm>.band-r::after{content:"";position:absolute;left:14px;right:14px;top:-9px;height:20px;pointer-events:none;background:repeating-linear-gradient(90deg,transparent 0 6px,#5A5F78 6px 7px,#C9CEDB 7px 9px,#4A4F66 9px 10px,transparent 10px 22px);-webkit-mask:linear-gradient(#000 0 75%,transparent);mask:linear-gradient(#000 0 75%,transparent)}',
    '#home-view.axd .band.axm .band-r .hd-l{color:#1F2A4D}',
    '#home-view.axd .band.axm .band-r .hd-l small{color:#9A8F7A}',
    '#home-view.axd .band.axm .band-r .cal{gap:0;border-top:1px solid #E4DCCB;border-left:1px solid #E4DCCB}',
    '#home-view.axd .band.axm .band-r .cal span{color:#9A8F7A;padding:4px 0;border-right:1px solid #E4DCCB;border-bottom:1px solid #E4DCCB;background:#F3ECDD}',
    '#home-view.axd .band.axm .band-r .cal i{border:0;border-right:1px solid #E4DCCB;border-bottom:1px solid #E4DCCB;border-radius:0;background:transparent;color:#3A3F58;font-family:"JetBrains Mono",monospace;font-size:11px}',
    '#home-view.axd .band.axm .band-r .cal i[style*=hidden]{visibility:visible!important;color:transparent;background:repeating-linear-gradient(135deg,transparent 0 5px,rgba(154,143,122,.12) 5px 6px)}',
    '#home-view.axd .band.axm .band-r .cal i.today-c{color:#2F6BFF;font-weight:700;box-shadow:inset 0 0 0 2px #2F6BFF;border-radius:48% 52% 46% 54%/54% 46% 54% 46%}',
    '#home-view.axd .band.axm .band-r .cal i svg{stroke:#C9483B}',
    '@supports selector(:has(a)){#home-view.axd .band.axm .band-r .cal i:has(svg) svg{display:none}',
    '#home-view.axd .band.axm .band-r .cal i:has(svg)::before,#home-view.axd .band.axm .band-r .cal i:has(svg)::after{content:"";position:absolute;left:16%;right:16%;top:50%;height:2.6px;margin-top:-1.3px;border-radius:2px;background:#C9483B;opacity:.9;transform:rotate(40deg) scaleX(0);animation:amX .35s cubic-bezier(.3,1.2,.5,1) .4s forwards}',
    '#home-view.axd .band.axm .band-r .cal i:has(svg)::after{transform:rotate(-36deg) scaleX(0);animation-name:amX2;animation-delay:.6s}}',
    '@keyframes amX{to{transform:rotate(40deg) scaleX(1)}}@keyframes amX2{to{transform:rotate(-36deg) scaleX(1)}}',
    '#home-view.axd .band.axm .band-r .goal-d .ring .seg.off{stroke:#DCD3C0}',
    '#home-view.axd .band.axm .band-r .goal-d .ring .seg.on{stroke:#C9483B}',
    '#home-view.axd .band.axm .band-r .goal-d .ring text{fill:#1F2A4D}',
    '#home-view.axd .band.axm .band-r .goal-d .goal-t .hand,#home-view.axd .band.axm .band-r .goal-d .goal-pick .hand{color:#1F2A4D}',
    '#home-view.axd .band.axm .band-r .goal-d .goal-t small{color:#8E8571}',
    '#home-view.axd .band.axm .band-r .goal-d .g-ch{color:#2F6BFF;text-decoration-color:#9DB8FF}',
    '#home-view.axd .band.axm .band-r .goal-d .goal-pick button{color:#1F2A4D;border-color:#CFC6B2!important;background:transparent}',
    '#home-view.axd .band.axm .band-r .goal-d .goal-pick button:hover,#home-view.axd .band.axm .band-r .goal-d .goal-pick button:focus-visible{border-color:#2F6BFF!important;color:#2F6BFF;background:rgba(47,107,255,.07)}',
    '#home-view.axd .band.axm .band-r .streak-note{color:#4A4F66}',
    '#home-view.axd .band.axm .band-r .streak-note b{color:#1F2A4D}',
    '#home-view.axd .band.axm .band-r .tally svg{color:#C9483B}',
    '#home-view.axd .band.axm .band-r .memo-b{color:#2F6BFF}',
    '#home-view.axd .band.axm .band-r .tour{color:#6B6F82;text-decoration-color:#C9483B}',
    /* şehir seçici */
    '.am-pick{position:relative;display:inline-block;margin-top:4px;z-index:5}',
    '.am-pick>button{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.35);background:rgba(10,18,56,.35);color:#fff;border-radius:999px;padding:4px 12px 4px 9px;font:600 13px/1.4 "Instrument Sans",system-ui,sans-serif;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}',
    '.axm[data-axm=day] .am-pick>button{background:rgba(255,255,255,.6);color:#0D1838;border-color:rgba(13,24,56,.25)}',
    '.am-pick>button svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
    '.am-pick>button:focus-visible,.am-pick li button:focus-visible{outline:2px solid #9DB8FF;outline-offset:2px}',
    '.am-pick ul{position:absolute;left:0;top:calc(100% + 6px);margin:0;padding:6px;list-style:none;background:#fff;border-radius:14px;box-shadow:0 18px 40px rgba(5,10,40,.35);display:grid;grid-template-columns:repeat(2,minmax(110px,1fr));gap:2px;min-width:250px}',
    '.am-pick ul[hidden]{display:none}',
    '.am-pick li button{width:100%;text-align:left;border:0;background:none;border-radius:9px;padding:8px 10px;font:500 14px "Instrument Sans",system-ui,sans-serif;color:#0D1838;cursor:pointer}',
    '.am-pick li button:hover{background:#EEF3FF}.am-pick li button[aria-current=true]{background:#0D1838;color:#fff}',
    /* koyu mod: sayfa ters çevrilir, bant aynı kalsın */
    'html.ax-dark #home-view .band.axm{filter:invert(1) hue-rotate(180deg)}',
    /* klasik / manzara seçimi */
    '#home-view .band:not(.axm) .am-scene,#home-view .band:not(.axm) .am-pick{display:none}',
    '.am-mode{position:relative;display:inline-block;margin:4px 0 0 6px;z-index:6;vertical-align:top}',
    '.am-mode>button{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.35);background:rgba(10,18,56,.35);color:#fff;border-radius:999px;padding:4px 11px 4px 8px;font:600 13px/1.4 "Instrument Sans",system-ui,sans-serif;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}',
    '.axm[data-axm=day] .am-mode>button{background:rgba(255,255,255,.6);color:#0D1838;border-color:rgba(13,24,56,.25)}',
    '.am-mode>button svg{width:15px;height:15px}',
    '.am-mode>button:focus-visible,.am-mode li button:focus-visible{outline:2px solid #9DB8FF;outline-offset:2px}',
    '.am-mode ul{position:absolute;left:0;top:calc(100% + 6px);margin:0;padding:6px;list-style:none;background:#fff;border-radius:14px;box-shadow:0 18px 40px rgba(5,10,40,.35);display:grid;grid-template-columns:1fr 1fr;gap:6px;min-width:260px}',
    '.am-mode ul[hidden]{display:none}',
    '.am-mode li button{width:100%;display:flex;flex-direction:column;align-items:stretch;gap:6px;border:2px solid transparent;background:#F6F4EE;border-radius:10px;padding:6px;font:600 13px "Instrument Sans",system-ui,sans-serif;color:#0D1838;cursor:pointer;text-align:left}',
    '.am-mode li button:hover{border-color:#C9D7FF}.am-mode li button[aria-current=true]{border-color:#2F6BFF;background:#EEF3FF}',
    '.am-mode li i{display:block;height:46px;border-radius:7px;position:relative;overflow:hidden}',
    '.am-mode li i.k{background:radial-gradient(60px 30px at 80% 0,rgba(255,244,226,.35),transparent 70%),#0D1838}',
    '.am-mode li i.k::after{content:"";position:absolute;left:62%;top:8px;width:18px;height:14px;border:2px solid #9DB8FF;border-radius:2px;background:#2F4C9E}',
    '.am-mode li i.m{background:linear-gradient(#7DB8F5 0 62%,#C99A67 62%)}',
    '.am-mode li i.m::after{content:"";position:absolute;left:8%;right:8%;bottom:38%;height:14px;background:linear-gradient(90deg,#56729E 0 14%,transparent 14% 18%,#7090BC 18% 34%,transparent 34% 38%,#56729E 38% 55%,transparent 55% 60%,#7090BC 60% 80%,transparent 80% 84%,#56729E 84%)}',
    '.am-mode li small{display:block;font-weight:500;font-size:11.5px;color:#6A7593}',
    '@media (max-width:760px){#home-view .band.axm .band-l>.am-pick{margin-bottom:64px}}',
    '@media (prefers-reduced-motion:reduce){.am-scene *{animation:none!important;transition:none!important}}'
  ].join('\n');

  /* ------------------------------------------------------------------ yardımcılar */
  var seed = 1;
  function R() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function el(t, a, p) {
    var e = document.createElementNS(NS, t);
    for (var k in a) { var v = a[k]; if (k === 'class') v = String(v).split(' ').map(function (c) { return 'a-' + c; }).join(' '); e.setAttribute(k, v); }
    if (p) p.appendChild(e); return e;
  }
  var H = 460, city, layers = [], CEN = [470, 1000];
  function inCen(x) { return x > CEN[0] - 40 && x < CEN[1]; }
  function L(k) { var g = el('g', {}, city); layers.push([g, k]); return g; }
  function haze(g, y) { el('rect', { class: 'hzr', x: -60, y: y, width: 1720, height: H - y, fill: 'url(#amHz)' }, g); }
  function P(g, d, c) { return el('path', { class: c || 'lm', d: d }, g); }
  function RECT(g, x, y, w, h, c, rx) { return el('rect', { class: c || 'lm', x: x, y: y, width: w, height: h, rx: rx || 0 }, g); }
  function glow(g, cx, cy, rx, ry) { el('ellipse', { class: 'glowL', cx: cx, cy: cy, rx: rx, ry: ry, fill: 'url(#amGlow)' }, g); }

  function blocks(g, cls, minH, maxH, minW, maxW, base, o) {
    var x = -60;
    while (x < 1660) {
      var w = minW + R() * (maxW - minW) | 0, h = minH + R() * (maxH - minH) | 0;
      if (inCen(x)) h = o.cenMin + R() * (o.cenMax - o.cenMin) | 0;
      if (h < 8) { x += w; continue; }
      var y = H - base - h, r = R();
      RECT(g, x, y, w, h + base, cls);
      if (r < .16) RECT(g, x + w * .3, y - 14, w * .4, 14, cls);
      else if (r < .24) P(g, 'M' + x + ' ' + y + ' L' + (x + w / 2) + ' ' + (y - 16) + ' L' + (x + w) + ' ' + y + 'Z', cls);
      else if (r < .34 && o.roof) { var tx = x + w * .62; RECT(g, tx, y - 16, 12, 10, cls, 2); RECT(g, tx + 1, y - 6, 2, 6, cls); RECT(g, tx + 9, y - 6, 2, 6, cls); }
      else if (r < .42 && o.roof) { RECT(g, x + 6, y - 6, 10, 6, cls); RECT(g, x + 20, y - 5, 8, 5, cls); }
      if (r > .9 && h > maxH * .7) { RECT(g, x + w / 2 - 1, y - 32, 2, 32, cls); el('circle', { class: 'beacon', cx: x + w / 2, cy: y - 33, r: 2.4 }, g); }
      if (o.rim) { RECT(g, x, y, 3, h + base, 'rimL'); RECT(g, x + w - 3, y, 3, h + base, 'rimR'); }
      if (o.win) {
        var cols = Math.max(1, Math.floor((w - 10) / 13)), rows = Math.floor((h - 14) / 18);
        for (var c = 0; c < cols; c++) for (var rr = 0; rr < rows; rr++) {
          var q = R(); if (q < .12) continue;
          RECT(g, x + 7 + c * 13, y + 10 + rr * 18, 6, 9, 'w' + (q < .12 + o.lit ? ' l1' : q < .12 + o.lit * 2.2 ? ' l2' : '') + (R() < .015 ? ' blink' : ''), 1);
        }
      }
      x += w + (R() * 10 | 0);
    }
  }
  function minaret(g, x, top, base, s, ser) {
    s = s || 1; ser = ser || 2;
    RECT(g, x - 2.8 * s, top, 5.6 * s, base - top);
    P(g, 'M' + (x - 3.4 * s) + ' ' + top + ' L' + x + ' ' + (top - 24 * s) + ' L' + (x + 3.4 * s) + ' ' + top + 'Z');
    for (var i = 0; i < ser; i++) { var sy = top + 20 * s + i * 28 * s; RECT(g, x - 5.5 * s, sy, 11 * s, 3 * s); RECT(g, x - 4.5 * s, sy + 3 * s, 9 * s, 1.6 * s, 'lt'); }
  }
  function mosque(g, cx, base, s, mins) {
    s = s || 1;
    glow(g, cx, base - 30 * s, 90 * s, 60 * s);
    RECT(g, cx - 50 * s, base - 32 * s, 100 * s, 40 * s);
    P(g, 'M' + (cx - 48 * s) + ' ' + (base - 32 * s) + ' A' + 20 * s + ' ' + 20 * s + ' 0 0 1 ' + (cx - 8 * s) + ' ' + (base - 32 * s) + 'Z M' + (cx + 8 * s) + ' ' + (base - 32 * s) + ' A' + 20 * s + ' ' + 20 * s + ' 0 0 1 ' + (cx + 48 * s) + ' ' + (base - 32 * s) + 'Z');
    RECT(g, cx - 28 * s, base - 46 * s, 56 * s, 14 * s);
    var dome = 'M' + (cx - 34 * s) + ' ' + (base - 44 * s) + ' A' + 34 * s + ' ' + 34 * s + ' 0 0 1 ' + (cx + 34 * s) + ' ' + (base - 44 * s);
    P(g, dome + 'Z'); P(g, dome, 'lts');
    RECT(g, cx - s, base - 90 * s, 2 * s, 14 * s);
    for (var i = 0; i < 7; i++) RECT(g, cx - 24 * s + i * 7.4 * s, base - 42 * s, 3 * s, 7 * s, 'lt', 1);
    var m = mins === 4 ? [[-62, 130], [-46, 110], [46, 110], [62, 130]] : mins === 2 ? [[-60, 130], [60, 130]] : [[58, 120]];
    m.forEach(function (d) { minaret(g, cx + d[0] * s, base - d[1] * s - 30 * s, base + 6, s, mins === 4 && d[1] > 120 ? 3 : 2); });
  }
  function sea(g, y, boats) {
    RECT(g, -60, y, 1720, H - y, 'sea');
    for (var i = 0; i < 46; i++) { var r = RECT(g, R() * 1600, y + 6 + R() * (H - y - 10), 10 + R() * 36, 1.6, 'wave', 1); r.style.animationDelay = (-R() * 5).toFixed(2) + 's'; }
    (boats || []).forEach(function (b) {
      var bx = b[0], by = b[1], s = b[2], gg = el('g', { class: 'boat' }, g); gg.style.animationDelay = (-R() * 6).toFixed(1) + 's';
      P(gg, 'M' + (bx - 14 * s) + ' ' + by + ' L' + (bx + 14 * s) + ' ' + by + ' L' + (bx + 10 * s) + ' ' + (by + 6 * s) + ' L' + (bx - 10 * s) + ' ' + (by + 6 * s) + 'Z');
      P(gg, 'M' + (bx - 2 * s) + ' ' + (by - 1) + ' L' + (bx - 2 * s) + ' ' + (by - 18 * s) + ' L' + (bx + 9 * s) + ' ' + (by - 2) + 'Z');
      el('circle', { class: 'lt', cx: bx + 6 * s, cy: by + 2 * s, r: 1.4 * s }, gg);
    });
  }
  function mountains(g, pts, snowFrom) {
    var d = 'M-60 ' + H + ' L-60 ' + (pts[0][1] + 60);
    pts.forEach(function (p, i) { var n = pts[i + 1]; d += ' L' + p[0] + ' ' + p[1]; if (n) d += ' L' + (p[0] + n[0]) / 2 + ' ' + (Math.max(p[1], n[1]) + 40 + R() * 30); });
    d += ' L1660 ' + (pts[pts.length - 1][1] + 60) + ' L1660 ' + H + 'Z'; P(g, d, 'h0');
    if (snowFrom != null) pts.forEach(function (p) {
      var x = p[0], y = p[1]; if (y > snowFrom) return; var k = (snowFrom - y) * .9;
      P(g, 'M' + x + ' ' + y + ' L' + (x + k * .75) + ' ' + (y + k * .6) + ' L' + (x + k * .4) + ' ' + (y + k * .48) + ' L' + (x + k * .15) + ' ' + (y + k * .66) + ' L' + (x - k * .2) + ' ' + (y + k * .44) + ' L' + (x - k * .5) + ' ' + (y + k * .62) + ' L' + (x - k * .75) + ' ' + (y + k * .6) + 'Z', 'snow');
    });
  }
  function hills(g, base, amp) { var d = 'M-60 ' + (base + 20); for (var x = -60; x <= 1660; x += 140) d += ' Q' + (x + 70) + ' ' + (base - amp - R() * amp) + ' ' + (x + 140) + ' ' + (base + R() * amp); P(g, d + ' V' + H + ' H-60Z', 'h0'); }
  function palm(g, x, base, h) {
    P(g, 'M' + (x - 2) + ' ' + base + ' C' + (x - 4) + ' ' + (base - h * .5) + ' ' + (x + 2) + ' ' + (base - h * .8) + ' ' + (x + 5) + ' ' + (base - h) + ' L' + (x + 8) + ' ' + (base - h) + ' C' + (x + 5) + ' ' + (base - h * .8) + ' ' + (x + 2) + ' ' + (base - h * .5) + ' ' + (x + 3) + ' ' + base + 'Z');
    var tx = x + 6, ty = base - h;
    [[-34, 6], [-26, -10], [0, -16], [26, -10], [34, 6], [-16, 14], [18, 14]].forEach(function (f) { P(g, 'M' + tx + ' ' + ty + ' Q' + (tx + f[0] * .5) + ' ' + (ty + f[1] - 10) + ' ' + (tx + f[0]) + ' ' + (ty + f[1]) + ' Q' + (tx + f[0] * .5) + ' ' + (ty + f[1] - 4) + ' ' + tx + ' ' + (ty + 2) + 'Z'); });
  }
  function castle(g, x0, x1, base, top, towers) {
    glow(g, (x0 + x1) / 2, top - 10, (x1 - x0) * .7, 50);
    P(g, 'M' + (x0 - 60) + ' ' + base + ' C' + x0 + ' ' + (top + 30) + ' ' + (x0 + 20) + ' ' + (top + 4) + ' ' + (x0 + 40) + ' ' + top + ' L' + (x1 - 40) + ' ' + top + ' C' + (x1 - 20) + ' ' + (top + 4) + ' ' + x1 + ' ' + (top + 30) + ' ' + (x1 + 60) + ' ' + base + 'Z');
    var w = x1 - x0 - 60; RECT(g, x0 + 30, top - 22, w, 24);
    for (var i = 0; i <= w / 10; i++) RECT(g, x0 + 30 + i * 10, top - 28, 6, 7);
    for (i = 0; i < towers; i++) { var tx = x0 + 30 + i * (w / (towers - 1)); RECT(g, tx - 10, top - 40, 20, 42); for (var j = 0; j < 3; j++) RECT(g, tx - 10 + j * 7.5, top - 46, 5, 7); RECT(g, tx - 2, top - 30, 4, 8, 'lt', 2); }
    var fx = x0 + 30 + w / 2; RECT(g, fx - 1, top - 70, 1.6, 48); RECT(g, fx + .6, top - 69, 14, 9, 'flag');
  }
  function kumbet(g, x, base, s) { RECT(g, x - 12 * s, base - 34 * s, 24 * s, 34 * s); P(g, 'M' + (x - 14 * s) + ' ' + (base - 34 * s) + ' L' + x + ' ' + (base - 62 * s) + ' L' + (x + 14 * s) + ' ' + (base - 34 * s) + 'Z'); RECT(g, x - 2 * s, base - 26 * s, 4 * s, 10 * s, 'lt', 2); }
  function house(g, x, base, w, h, s) {
    s = s || 1; RECT(g, x, base - h * .5, w, h * .5); RECT(g, x - 6 * s, base - h, w + 12 * s, h * .52);
    P(g, 'M' + (x - 12 * s) + ' ' + (base - h) + ' L' + (x + w / 2) + ' ' + (base - h - 18 * s) + ' L' + (x + w + 12 * s) + ' ' + (base - h) + 'Z');
    for (var i = 0; i < Math.floor(w / 12); i++) RECT(g, x + 4 + i * 12, base - h + 8 * s, 6, 10 * s, 'w l1', 1);
  }
  function arch(g, x, b, w, h) { P(g, 'M' + (x - w) + ' ' + b + ' V' + (b - h) + ' A' + w + ' ' + w + ' 0 0 1 ' + (x + w) + ' ' + (b - h) + ' V' + b + 'Z', 'lt'); }

  /* ------------------------------------------------------------------ 10 şehrin simgeleri */
  var LM = {
    ankara: function (g) {
      var ax = 545; glow(g, ax, 112, 50, 30);
      P(g, 'M' + (ax - 10) + ' ' + H + ' L' + (ax - 6) + ' 128 L' + (ax + 6) + ' 128 L' + (ax + 10) + ' ' + H + 'Z');
      P(g, 'M' + (ax - 12) + ' 130 L' + (ax - 28) + ' 112 L' + (ax + 28) + ' 112 L' + (ax + 12) + ' 130Z');
      el('ellipse', { class: 'lm', cx: ax, cy: 106, rx: 30, ry: 10 }, g);
      P(g, 'M' + (ax - 26) + ' 102 C' + (ax - 24) + ' 84 ' + (ax + 24) + ' 84 ' + (ax + 26) + ' 102Z');
      RECT(g, ax - 1.2, 56, 2.4, 34); el('circle', { class: 'beacon', cx: ax, cy: 55, r: 3 }, g);
      for (var i = 0; i < 9; i++) RECT(g, ax - 22 + i * 5.2, 93, 3, 6, 'lt', 1);
      P(g, 'M' + (ax - 30) + ' 106 C' + (ax - 10) + ' 112 ' + (ax + 10) + ' 112 ' + (ax + 30) + ' 106', 'lts');
      P(g, 'M450 400 C560 352 630 320 700 316 C780 315 860 344 960 400 Z');
      glow(g, 700, 296, 110, 40);
      RECT(g, 630, 308, 140, 8); RECT(g, 644, 282, 112, 28); RECT(g, 638, 276, 124, 7); RECT(g, 652, 271, 96, 6);
      for (i = 0; i < 14; i++) RECT(g, 649 + i * 7.6, 286, 3.2, 20, 'lt');
      RECT(g, 600, 298, 30, 12); RECT(g, 770, 298, 30, 12);
      RECT(g, 782, 244, 1.6, 56); RECT(g, 783.6, 245, 15, 10, 'flag');
      mosque(g, 900, 330, 1, 4);
    },
    istanbul: function (g) {
      mosque(g, 520, 330, .95, 4);
      sea(g, 345, [[1000, 372, 1], [640, 392, .8]]);
      var t1 = 640, t2 = 880, dk = 338, tt = 208;
      [t1, t2].forEach(function (t) { RECT(g, t - 6, tt, 4, dk - tt + 40); RECT(g, t + 2, tt, 4, dk - tt + 40); RECT(g, t - 6, tt + 20, 12, 4); RECT(g, t - 6, tt + 70, 12, 4); el('circle', { class: 'beacon', cx: t, cy: tt - 3, r: 2.4 }, g); });
      RECT(g, 560, dk, 400, 5);
      var cab = 'M560 ' + (dk - 4) + ' Q600 ' + (dk - 60) + ' ' + t1 + ' ' + tt + ' Q' + (t1 + t2) / 2 + ' ' + (dk + 10) + ' ' + t2 + ' ' + tt + ' Q920 ' + (dk - 60) + ' 960 ' + (dk - 4);
      P(g, cab, 'cable'); P(g, cab, 'lts');
      for (var x = t1 + 12; x < t2; x += 12) { var f = (x - t1) / (t2 - t1), y = tt + (1 - Math.pow(2 * f - 1, 2)) * (dk - tt - 6); RECT(g, x, y, 1, dk - y, 'hanger'); }
      for (x = 566; x < 955; x += 10) RECT(g, x, dk + 1, 4, 2, 'lt');
      var gx = 1000, gb = 345; glow(g, gx, 240, 50, 70);
      P(g, 'M' + (gx - 80) + ' ' + gb + ' C' + (gx - 40) + ' ' + (gb - 30) + ' ' + (gx + 40) + ' ' + (gb - 34) + ' ' + (gx + 90) + ' ' + gb + 'Z');
      RECT(g, gx - 15, 232, 30, gb - 246); RECT(g, gx - 19, 226, 38, 7); RECT(g, gx - 16, 210, 32, 16);
      for (var i = 0; i < 5; i++) RECT(g, gx - 12 + i * 5.4, 212, 3, 13, 'lt', 1);
      P(g, 'M' + (gx - 18) + ' 210 L' + gx + ' 160 L' + (gx + 18) + ' 210Z');
      for (i = 0; i < 3; i++) RECT(g, gx - 8 + i * 7, 250, 3, 8, 'lt', 1);
    },
    izmir: function (g) {
      P(g, 'M380 360 C460 270 540 250 620 252 C700 254 760 290 840 360Z', 'h1');
      for (var i = 0; i < 14; i++) RECT(g, 520 + i * 10, 240, 6, 8, 'h1'); RECT(g, 516, 246, 146, 10, 'h1');
      sea(g, 355, [[600, 380, 1], [1080, 392, .8]]);
      var sx = 880, sb = 372; glow(g, sx, 240, 60, 90);
      RECT(g, sx - 38, sb - 8, 76, 10); RECT(g, sx - 24, sb - 46, 48, 40);
      for (i = 0; i < 4; i++) arch(g, sx - 17 + i * 12, sb - 10, 5, 20);
      RECT(g, sx - 18, sb - 96, 36, 52); RECT(g, sx - 22, sb - 100, 44, 6); el('circle', { class: 'lt', cx: sx, cy: sb - 74, r: 9 }, g);
      RECT(g, sx - 13, sb - 142, 26, 44); RECT(g, sx - 16, sb - 146, 32, 6);
      for (i = 0; i < 3; i++) RECT(g, sx - 9 + i * 7, sb - 136, 3, 14, 'lt', 1);
      RECT(g, sx - 9, sb - 172, 18, 28); P(g, 'M' + (sx - 11) + ' ' + (sb - 172) + ' A11 12 0 0 1 ' + (sx + 11) + ' ' + (sb - 172) + 'Z'); RECT(g, sx - 1, sb - 198, 2, 16);
      palm(g, 780, sb, 64); palm(g, 960, sb, 76); palm(g, 1010, sb, 58);
    },
    bursa: function (g) {
      mosque(g, 980, 332, .75, 1);
      var ux = 600, ub = 340; glow(g, ux, ub - 30, 150, 50);
      RECT(g, ux - 110, ub - 44, 220, 48);
      for (var i = 0; i < 5; i++) { var dx = ux - 88 + i * 44; RECT(g, dx - 16, ub - 54, 32, 10); P(g, 'M' + (dx - 18) + ' ' + (ub - 54) + ' A18 18 0 0 1 ' + (dx + 18) + ' ' + (ub - 54) + 'Z'); RECT(g, dx - .8, ub - 80, 1.6, 8); }
      for (i = 0; i < 10; i++) arch(g, ux - 94 + i * 21, ub - 6, 4, 18);
      minaret(g, ux - 124, ub - 150, ub + 6, 1, 2); minaret(g, ux + 124, ub - 150, ub + 6, 1, 2);
      var yx = 820, yb = 336; glow(g, yx, yb - 40, 60, 50);
      RECT(g, yx - 26, yb - 50, 52, 54, 'mev'); for (i = 0; i < 3; i++) RECT(g, yx - 16 + i * 13, yb - 40, 6, 14, 'lt', 3);
      RECT(g, yx - 20, yb - 60, 40, 10, 'mev'); P(g, 'M' + (yx - 22) + ' ' + (yb - 60) + ' A22 24 0 0 1 ' + (yx + 22) + ' ' + (yb - 60) + 'Z', 'mev'); RECT(g, yx - .8, yb - 92, 1.6, 10);
    },
    antalya: function (g) {
      sea(g, 352, [[1040, 380, 1], [520, 392, .7]]);
      var mx = 600, mb = 360; glow(g, mx, 200, 50, 110);
      RECT(g, mx - 30, mb - 30, 60, 34); P(g, 'M' + (mx - 30) + ' ' + (mb - 30) + ' A30 20 0 0 1 ' + (mx + 30) + ' ' + (mb - 30) + 'Z');
      RECT(g, mx - 15, mb - 120, 30, 90); P(g, 'M' + (mx - 15) + ' ' + (mb - 120) + ' L' + (mx - 11) + ' ' + (mb - 200) + ' L' + (mx + 11) + ' ' + (mb - 200) + ' L' + (mx + 15) + ' ' + (mb - 120) + 'Z');
      for (var i = 0; i < 4; i++) RECT(g, mx - 9 + i * 5.6, mb - 196, 1.6, 74, 'lt');
      RECT(g, mx - 15, mb - 208, 30, 8); RECT(g, mx - 14, mb - 206, 28, 2, 'lt'); RECT(g, mx - 8, mb - 232, 16, 24); P(g, 'M' + (mx - 10) + ' ' + (mb - 232) + ' L' + mx + ' ' + (mb - 252) + ' L' + (mx + 10) + ' ' + (mb - 232) + 'Z');
      var hx = 820, hb = 362; glow(g, hx, hb - 40, 110, 50);
      RECT(g, hx - 100, hb - 74, 22, 78); RECT(g, hx + 78, hb - 74, 22, 78);
      P(g, 'M' + (hx - 102) + ' ' + (hb - 74) + ' L' + (hx - 89) + ' ' + (hb - 92) + ' L' + (hx - 76) + ' ' + (hb - 74) + 'Z M' + (hx + 76) + ' ' + (hb - 74) + ' L' + (hx + 89) + ' ' + (hb - 92) + ' L' + (hx + 102) + ' ' + (hb - 74) + 'Z');
      RECT(g, hx - 78, hb - 62, 156, 14); RECT(g, hx - 80, hb - 70, 160, 8);
      for (i = 0; i < 3; i++) { var ax = hx - 52 + i * 52; RECT(g, ax - 26, hb - 48, 52, 52); arch(g, ax, hb, 18, 28); }
      palm(g, 700, hb, 70); palm(g, 950, hb, 82); palm(g, 990, hb, 60);
    },
    konya: function (g) {
      var mx = 640, mb = 340; glow(g, mx, mb - 80, 90, 90);
      RECT(g, mx - 90, mb - 40, 180, 44);
      [-2, -1, 1, 2].forEach(function (i) { var dx = mx + i * 34; P(g, 'M' + (dx - 14) + ' ' + (mb - 40) + ' A14 14 0 0 1 ' + (dx + 14) + ' ' + (mb - 40) + 'Z'); });
      RECT(g, mx - 20, mb - 80, 40, 42, 'mev'); RECT(g, mx - 24, mb - 84, 48, 6, 'mev');
      P(g, 'M' + (mx - 24) + ' ' + (mb - 84) + ' L' + mx + ' ' + (mb - 170) + ' L' + (mx + 24) + ' ' + (mb - 84) + 'Z', 'mev');
      for (var i = -2; i <= 2; i++) P(g, 'M' + (mx + i * 9) + ' ' + (mb - 84) + ' L' + mx + ' ' + (mb - 166), 'fl');
      RECT(g, mx - .8, mb - 190, 1.6, 22);
      for (i = 0; i < 3; i++) RECT(g, mx - 12 + i * 9, mb - 70, 4, 10, 'lt', 2);
      minaret(g, mx + 120, mb - 170, mb + 6, 1, 2);
      mosque(g, 880, 336, .8, 2);
    },
    eskisehir: function (g) {
      var sx = 600, sb = 346; glow(g, sx, sb - 90, 120, 90);
      RECT(g, sx - 90, sb - 60, 180, 64);
      for (var i = 0; i < 18; i++) RECT(g, sx - 90 + i * 10, sb - 66, 6, 7);
      [[-100, 120, 16], [-46, 170, 20], [0, 210, 24], [48, 150, 18], [100, 110, 14]].forEach(function (t) {
        var tx = sx + t[0], h = t[1], w = t[2];
        RECT(g, tx - w / 2, sb - h, w, h); P(g, 'M' + (tx - w / 2 - 4) + ' ' + (sb - h) + ' L' + tx + ' ' + (sb - h - w * 2.2) + ' L' + (tx + w / 2 + 4) + ' ' + (sb - h) + 'Z');
        RECT(g, tx - 2, sb - h + 16, 4, 9, 'lt', 2); RECT(g, tx, sb - h - w * 2.2 - 10, 9, 6, 'flag'); RECT(g, tx - .6, sb - h - w * 2.2 - 10, 1.2, 12);
      });
      arch(g, sx, sb, 14, 26);
      [[760, 344, 44, 64], [816, 350, 38, 56], [866, 342, 48, 70], [926, 348, 40, 58], [976, 346, 44, 62]].forEach(function (h) { house(g, h[0], h[1], h[2], h[3]); });
    },
    trabzon: function (g) {
      sea(g, 350, [[600, 378, 1], [1040, 388, .9]]);
      var ax = 640, ab = 352; glow(g, ax, ab - 60, 110, 60);
      RECT(g, ax - 80, ab - 50, 160, 54); P(g, 'M' + (ax - 84) + ' ' + (ab - 50) + ' L' + ax + ' ' + (ab - 74) + ' L' + (ax + 84) + ' ' + (ab - 50) + 'Z');
      RECT(g, ax - 16, ab - 104, 32, 40); P(g, 'M' + (ax - 18) + ' ' + (ab - 104) + ' A18 16 0 0 1 ' + (ax + 18) + ' ' + (ab - 104) + 'Z');
      for (var i = 0; i < 4; i++) arch(g, ax - 10 + i * 7, ab - 70, 2, 20);
      for (i = 0; i < 3; i++) arch(g, ax - 52 + i * 48, ab, 8, 26);
      var bx = ax - 120; RECT(g, bx - 14, ab - 110, 28, 114); P(g, 'M' + (bx - 16) + ' ' + (ab - 110) + ' L' + bx + ' ' + (ab - 128) + ' L' + (bx + 16) + ' ' + (ab - 110) + 'Z'); arch(g, bx, ab - 70, 6, 20);
      for (i = 0; i < 9; i++) { var hx = 800 + i * 26, hb = 350 - i * 8; RECT(g, hx, hb - 24, 22, 24); P(g, 'M' + (hx - 3) + ' ' + (hb - 24) + ' L' + (hx + 11) + ' ' + (hb - 34) + ' L' + (hx + 25) + ' ' + (hb - 24) + 'Z'); RECT(g, hx + 8, hb - 16, 5, 6, 'w l1'); }
      mosque(g, 1010, 300, .55, 1);
    },
    erzurum: function (g) {
      var cx = 640, cb = 344; glow(g, cx, cb - 70, 130, 70);
      RECT(g, cx - 120, cb - 50, 240, 54); RECT(g, cx - 40, cb - 78, 80, 82);
      P(g, 'M' + (cx - 22) + ' ' + cb + ' V' + (cb - 40) + ' Q' + cx + ' ' + (cb - 70) + ' ' + (cx + 22) + ' ' + (cb - 40) + ' V' + cb + 'Z', 'lt');
      [-32, 32].forEach(function (dx) { var mx = cx + dx; RECT(g, mx - 9, cb - 190, 18, 116); for (var i = 0; i < 4; i++) RECT(g, mx - 6 + i * 3.6, cb - 184, 1.4, 104, 'lt'); RECT(g, mx - 11, cb - 196, 22, 8); });
      RECT(g, cx - 120, cb - 60, 26, 64); P(g, 'M' + (cx - 122) + ' ' + (cb - 60) + ' A13 10 0 0 1 ' + (cx - 94) + ' ' + (cb - 60) + 'Z');
      kumbet(g, 840, 346, 1.1); kumbet(g, 896, 340, 1.3); kumbet(g, 952, 346, 1);
    },
    gaziantep: function (g) {
      castle(g, 560, 860, 372, 258, 5);
      mosque(g, 980, 336, .75, 1);
      for (var i = 0; i < 6; i++) house(g, 400 + i * 30, 364, 24, 36, .8);
    }
  };
  var CITIES = {
    ankara: { ad: 'Ankara', lat: 39.93, lon: 32.86, far: function (g) { P(g, 'M-60 300 C120 250 260 270 400 262 C560 246 700 272 860 256 C1020 240 1180 268 1320 254 C1460 242 1560 262 1660 256 V460 H-60Z', 'h0'); } },
    istanbul: { ad: 'İstanbul', lat: 41.01, lon: 28.98, coast: 1, far: function (g) { hills(g, 280, 14); } },
    izmir: { ad: 'İzmir', lat: 38.42, lon: 27.14, coast: 1, far: function (g) { mountains(g, [[60, 210], [300, 190], [560, 230], [900, 200], [1200, 220], [1500, 196]]); } },
    bursa: { ad: 'Bursa', lat: 40.19, lon: 29.06, far: function (g) { mountains(g, [[-40, 250], [300, 190], [720, 70], [1100, 150], [1500, 220]], 170); } },
    antalya: { ad: 'Antalya', lat: 36.89, lon: 30.71, coast: 1, far: function (g) { mountains(g, [[0, 170], [220, 120], [430, 160], [700, 110], [980, 150], [1260, 100], [1540, 150]], 130); } },
    konya: { ad: 'Konya', lat: 37.87, lon: 32.49, far: function (g) { hills(g, 300, 10); } },
    eskisehir: { ad: 'Eskişehir', lat: 39.78, lon: 30.52, far: function (g) { hills(g, 280, 16); } },
    trabzon: { ad: 'Trabzon', lat: 41.00, lon: 39.72, coast: 1, far: function (g) { mountains(g, [[-20, 160], [260, 120], [520, 170], [820, 110], [1120, 150], [1420, 120]]); } },
    erzurum: { ad: 'Erzurum', lat: 39.90, lon: 41.27, far: function (g) { mountains(g, [[0, 200], [280, 130], [560, 160], [860, 90], [1160, 140], [1460, 110]], 200); } },
    gaziantep: { ad: 'Gaziantep', lat: 37.07, lon: 37.38, far: function (g) { hills(g, 290, 12); } }
  };
  var ORDER = ['ankara', 'istanbul', 'izmir', 'bursa', 'antalya', 'konya', 'eskisehir', 'trabzon', 'erzurum', 'gaziantep'];

  function build(key) {
    var c = CITIES[key] || CITIES.ankara; cur = c; cur.key = CITIES[key] ? key : 'ankara';
    layers.length = 0;
    Array.prototype.slice.call(city.childNodes).forEach(function (n) { if (n.nodeName !== 'defs') city.removeChild(n); });
    seed = cur.key.split('').reduce(function (a, ch) { return a * 31 + ch.charCodeAt(0) | 0; }, 7);
    CEN = c.coast ? [480, 1040] : [470, 1000];
    var g0 = L(.15); c.far(g0); haze(g0, 230);
    var g1 = L(.3); blocks(g1, 'h1', c.coast ? 60 : 80, c.coast ? 150 : 180, 36, 76, 40, { cenMin: c.coast ? 20 : 40, cenMax: c.coast ? 60 : 90 }); haze(g1, 250);
    var g2 = L(.5); LM[cur.key](g2); haze(g2, 300);
    var g3 = L(.75); blocks(g3, 'h2', 120, 260, 46, 96, 20, { cenMin: c.coast ? -30 : 30, cenMax: c.coast ? 0 : 70, win: true, lit: .2, rim: true, roof: true }); haze(g3, 380);
    var g4 = L(1.1); blocks(g4, 'h3', 70, 170, 60, 130, 0, { cenMin: c.coast ? -30 : 20, cenMax: c.coast ? 0 : 50, win: true, lit: .16, rim: true, roof: true });
  }

  /* ------------------------------------------------------------------ gerçek gün doğumu / batımı */
  function sunTimes(date, lat, lon) {
    var start = Date.UTC(date.getUTCFullYear(), 0, 1), n = Math.floor((date - start) / 864e5) + 1;
    var g = 2 * Math.PI / 365 * (n - 1), rad = Math.PI / 180;
    var eq = 229.18 * (.000075 + .001868 * Math.cos(g) - .032077 * Math.sin(g) - .014615 * Math.cos(2 * g) - .040849 * Math.sin(2 * g));
    var dec = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g) - .006758 * Math.cos(2 * g) + .000907 * Math.sin(2 * g) - .002697 * Math.cos(3 * g) + .00148 * Math.sin(3 * g);
    var ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(dec)) - Math.tan(lat * rad) * Math.tan(dec)) / rad;
    return { rise: 720 - 4 * (lon + ha) - eq + 180, set: 720 - 4 * (lon - ha) - eq + 180 };   // Türkiye saati (UTC+3), dakika
  }
  function trMin(d) { return ((d.getUTCHours() + 3) % 24) * 60 + d.getUTCMinutes(); }
  function phaseAt(m, t) { return m >= t.rise - 40 && m < t.rise + 50 ? 'dawn' : m >= t.rise + 50 && m < t.set - 50 ? 'day' : m >= t.set - 50 && m < t.set + 40 ? 'dusk' : 'night'; }

  /* ------------------------------------------------------------------ kurulum */
  var band, scene, view, sunEl, steam, mug, cur, pickBtn, pickList;

  function sceneHTML() {
    return '<div class="am-view">' +
      '<div class="am-par" data-k="-.15"><div class="am-sky dawn"></div><div class="am-sky day"></div><div class="am-sky dusk"></div><div class="am-sky night"></div>' +
      '<svg class="am-stars" viewBox="0 0 1600 400" preserveAspectRatio="xMidYMid slice"></svg><i class="am-sun"></i><i class="am-moon"></i></div>' +
      '<div class="am-par" data-k=".25">' +
      '<svg class="am-cl a" viewBox="0 0 150 50"><path d="M20 44 C4 44 2 26 18 24 C18 10 38 6 46 16 C52 2 80 0 88 18 C100 10 120 14 120 28 C136 26 146 44 128 44 Z"/></svg>' +
      '<svg class="am-cl b" viewBox="0 0 150 50"><path d="M20 44 C6 44 6 30 20 28 C24 16 42 14 50 22 C58 8 84 8 92 24 C110 20 126 30 120 44 Z"/></svg>' +
      '<svg class="am-cl c" viewBox="0 0 150 50"><path d="M14 44 C0 42 4 28 18 28 C20 14 40 12 48 20 C56 6 82 4 90 20 C104 14 122 20 122 32 C140 30 148 44 132 44 Z"/></svg>' +
      '<svg class="am-birds" width="70" height="24" viewBox="0 0 70 24"><path d="M2 10 Q8 4 14 10 Q20 4 26 10"/><path d="M34 18 Q39 13 44 18 Q49 13 54 18"/><path d="M50 6 Q54 2 58 6 Q62 2 66 6"/></svg></div>' +
      '<svg class="am-city" viewBox="0 0 1600 460" preserveAspectRatio="xMidYMax slice"><defs>' +
      '<linearGradient id="amHz" class="am-hz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-opacity="0"/><stop offset=".65" stop-opacity=".55"/><stop offset="1" stop-opacity=".9"/></linearGradient>' +
      '<radialGradient id="amGlow"><stop offset="0" stop-color="#FFD9A0" stop-opacity=".45"/><stop offset="1" stop-color="#FFD9A0" stop-opacity="0"/></radialGradient></defs></svg>' +
      '<div class="am-grain"></div><div class="am-glare"></div><i class="am-mul v1"></i><i class="am-mul v2"></i><i class="am-mul h"></i><div class="am-frame"></div></div>' +
      '<div class="am-desk"><div class="am-wood"></div><i class="am-patch"></i>' +
      '<div class="am-pencil"><i class="sh"></i><svg viewBox="0 0 120 30"><path d="M8 15 L22 7 L104 7 C108 7 110 11 110 15 C110 19 108 23 104 23 L22 23 Z" fill="#2F6BFF"/><path d="M22 7 L104 7 C108 7 110 11 110 11 L22 11Z" fill="#6E96FF"/><path d="M8 15 L22 7 L22 23 Z" fill="#F3D9B1"/><path d="M8 15 L12 13 L12 17Z" fill="#0D1838"/><path d="M96 7 V23" stroke="#9DB8FF" stroke-width="3"/></svg></div>' +
      '<div class="am-mug"><i class="sh"></i><svg viewBox="0 0 84 100"><g class="st"><path d="M28 30 C22 22 34 16 28 6"/><path d="M42 28 C36 20 48 14 42 4"/><path d="M56 30 C50 22 62 16 56 8"/></g>' +
      '<path d="M66 50 C80 48 82 62 76 70 C72 76 66 77 63 76" fill="none" stroke="#24356F" stroke-width="6"/><path d="M12 38 L68 38 L64 90 C64 94 60 96 56 96 L24 96 C20 96 16 94 16 90 Z" fill="#2B3F82"/>' +
      '<path d="M14 40 L22 40 L24 94 C20 94 17 92 17 89 Z" fill="#fff" opacity=".12"/><path d="M58 40 L67 40 L63 90 C63 93 61 95 58 95 Z" fill="#000" opacity=".18"/><path d="M18 46 L66 46" stroke="#9DB8FF" stroke-width="2" opacity=".6"/>' +
      '<ellipse cx="40" cy="38" rx="28" ry="5" fill="#3E2416"/><ellipse cx="40" cy="38" rx="28" ry="5" fill="none" stroke="#3C55A3" stroke-width="2"/>' +
      '<text x="40" y="76" text-anchor="middle" font-family="Bricolage Grotesque,sans-serif" font-weight="800" font-size="20" fill="#9DB8FF" class="am-ini">A</text></svg></div>' +
      '<i class="am-screen"></i></div>';
  }

  /* masanın üst kenarını belgelerin altına hizala */
  function layout() {
    if (!band) return;
    var b = band.getBoundingClientRect(); if (!b.height) return;
    var vis = function (s) { var e = band.querySelector(s); return e && !e.hidden && e.offsetParent !== null ? e : null; };
    var o = vis('.objs'), de = vis('.desk-empty'), gr = vis('.go-row'), top;
    if (o) { var r = o.getBoundingClientRect(); top = r.top - b.top + r.height * .62; }
    else if (de) top = de.getBoundingClientRect().top - b.top - 18;
    else if (gr) top = gr.getBoundingClientRect().top - b.top - 70;
    else top = b.height - 170;
    top = Math.max(170, Math.min(top, b.height - 110));
    band.style.setProperty('--desk-top', Math.round(top) + 'px');
    // kupa ve kalem: belgelerin sağında, dar ekranda sağ kenarda
    var bl = band.querySelector('.band-l'), narrow = b.width < 900;
    var right = o ? o.getBoundingClientRect().right - b.left : (bl ? bl.getBoundingClientRect().left - b.left + 380 : 400);
    var mugX = narrow ? b.width - 100 : Math.min(right + 150, (bl ? bl.getBoundingClientRect().right - b.left : b.width * .55) - 90);
    band.style.setProperty('--mug-x', Math.round(mugX) + 'px');
    band.style.setProperty('--pen-x', Math.round(narrow ? mugX - 120 : mugX - 130) + 'px');
    scene.querySelector('.am-pencil').style.display = narrow && b.width < 520 ? 'none' : '';
  }

  function apply() {
    var now = new Date(), t = sunTimes(now, cur.lat, cur.lon), m = trMin(now), p = phaseAt(m, t);
    if (band.getAttribute('data-axm') !== p) band.setAttribute('data-axm', p);
    if (p !== 'night') {
      var f = Math.max(-.06, Math.min(1.06, (m - t.rise) / (t.set - t.rise)));
      sunEl.style.left = (6 + f * 82).toFixed(1) + '%';
      sunEl.style.top = (64 - Math.sin(Math.PI * Math.max(0, Math.min(1, f))) * 56).toFixed(1) + '%';
      band.style.setProperty('--a-patch-x', (64 - f * 52).toFixed(1) + '%');
      band.style.setProperty('--a-shx', ((f - .5) * -30).toFixed(1) + 'px');
    }
  }

  function setCity(key, save) {
    if (!CITIES[key]) key = 'ankara';
    build(key); apply();
    if (save) store.set('axm-city', key);
    if (pickBtn) {
      pickBtn.querySelector('span').textContent = cur.ad;
      pickBtn.setAttribute('aria-label', 'Manzara şehri: ' + cur.ad + '. Değiştirmek için seç');
      Array.prototype.forEach.call(pickList.querySelectorAll('button'), function (b) { b.setAttribute('aria-current', b.getAttribute('data-k') === key ? 'true' : 'false'); });
    }
  }

  function picker() {
    var date = band.querySelector('.band-l > .date'); if (!date) return;
    var w = document.createElement('div'); w.className = 'am-pick';
    w.innerHTML = '<button type="button" aria-haspopup="true" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 C8 16 5 12.5 5 9.5 A7 7 0 0 1 19 9.5 C19 12.5 16 16 12 21Z"/><circle cx="12" cy="9.5" r="2.4"/></svg><span></span></button>' +
      '<ul hidden>' + ORDER.map(function (k) { return '<li><button type="button" data-k="' + k + '">' + CITIES[k].ad + '</button></li>'; }).join('') + '</ul>';
    date.insertAdjacentElement('afterend', w);
    pickBtn = w.firstChild; pickList = w.querySelector('ul');
    var open = function (v) { pickList.hidden = !v; pickBtn.setAttribute('aria-expanded', v ? 'true' : 'false'); if (v) { var c = pickList.querySelector('[aria-current=true]') || pickList.querySelector('button'); c && c.focus(); } };
    pickBtn.addEventListener('click', function () { open(pickList.hidden); });
    pickList.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; setCity(b.getAttribute('data-k'), true); open(false); pickBtn.focus(); });
    document.addEventListener('click', function (e) { if (!w.contains(e.target)) open(false); });
    w.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { open(false); pickBtn.focus(); }
      if (!pickList.hidden && /Arrow(Up|Down|Left|Right)/.test(e.key)) {
        var bs = Array.prototype.slice.call(pickList.querySelectorAll('button')), i = bs.indexOf(document.activeElement);
        var d = { ArrowDown: 2, ArrowUp: -2, ArrowRight: 1, ArrowLeft: -1 }[e.key];
        bs[(i + d + bs.length) % bs.length].focus(); e.preventDefault();
      }
    });
  }

  function parallax() {
    if (reduce) return;
    var html = Array.prototype.map.call(scene.querySelectorAll('.am-par'), function (e) { return [e, +e.getAttribute('data-k')]; });
    var tx = 0, ty = 0, cx = 0, cy = 0, sx = 0, csx = 0, raf = 0;
    function tick() {
      cx += (tx - cx) * .08; cy += (ty - cy) * .08; csx += (sx - csx) * .06;
      html.forEach(function (h) { h[0].style.transform = 'translate3d(' + (-cx * 14 * h[1]).toFixed(2) + 'px,' + (-cy * 14 * h[1] * .4).toFixed(2) + 'px,0)'; });
      layers.forEach(function (l) { l[0].setAttribute('transform', 'translate(' + (-cx * 14 * l[1]).toFixed(2) + ' ' + (-cy * 14 * l[1] * .35).toFixed(2) + ')'); });
      steam.style.transform = 'skewX(' + (-csx * 18).toFixed(2) + 'deg)';
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) + Math.abs(sx - csx) > .002 ? requestAnimationFrame(tick) : 0;
    }
    var kick = function () { if (!raf) raf = requestAnimationFrame(tick); };
    band.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = band.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width * 2 - 1; ty = (e.clientY - r.top) / r.height * 2 - 1;
      var m = mug.getBoundingClientRect(), d = (e.clientX - (m.left + m.width / 2)) / 220;
      sx = Math.max(-1, Math.min(1, d)) * Math.max(0, 1 - Math.abs(e.clientY - m.top) / 300); kick();
    });
    band.addEventListener('pointerleave', function () { tx = ty = sx = 0; kick(); });
  }

  /* masa görünümü: klasik (eski koyu masa) ya da manzara (pencereli oda); seçim bu tarayıcıda kalır */
  var modeBtn, modeList;
  function setMode(m, save) {
    m = m === 'klasik' ? 'klasik' : 'manzara';
    var on = m === 'manzara';
    band.classList.toggle('axm', on); band.classList.toggle('am-objdim', on);
    if (save) store.set('axm-mode', m);
    if (modeBtn) {
      modeBtn.querySelector('span').textContent = on ? 'Manzara' : 'Klasik';
      modeBtn.setAttribute('aria-label', 'Masa görünümü: ' + (on ? 'Manzara' : 'Klasik') + '. Değiştirmek için seç');
      Array.prototype.forEach.call(modeList.querySelectorAll('button'), function (b) { b.setAttribute('aria-current', b.getAttribute('data-m') === m ? 'true' : 'false'); });
    }
    if (on) { layout(); apply(); }
  }
  function modeSwitch() {
    var anchor = band.querySelector('.band-l > .am-pick') || band.querySelector('.band-l > .date'); if (!anchor) return;
    var w = document.createElement('div'); w.className = 'am-mode';
    w.innerHTML = '<button type="button" aria-haspopup="true" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg><span></span></button>' +
      '<ul hidden><li><button type="button" data-m="klasik"><i class="k"></i>Klasik<small>koyu masa, lamba</small></button></li><li><button type="button" data-m="manzara"><i class="m"></i>Manzara<small>pencere, şehir, gün ışığı</small></button></li></ul>';
    anchor.insertAdjacentElement('afterend', w);
    modeBtn = w.firstChild; modeList = w.querySelector('ul');
    var open = function (v) { modeList.hidden = !v; modeBtn.setAttribute('aria-expanded', v ? 'true' : 'false'); if (v) { var c = modeList.querySelector('[aria-current=true]') || modeList.querySelector('button'); c && c.focus(); } };
    modeBtn.addEventListener('click', function () { open(modeList.hidden); });
    modeList.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; setMode(b.getAttribute('data-m'), true); open(false); modeBtn.focus(); });
    document.addEventListener('click', function (e) { if (!w.contains(e.target)) open(false); });
    w.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { open(false); modeBtn.focus(); }
      if (!modeList.hidden && /Arrow(Left|Right|Up|Down)/.test(e.key)) { var bs = Array.prototype.slice.call(modeList.querySelectorAll('button')), i = bs.indexOf(document.activeElement); bs[(i + 1) % 2].focus(); e.preventDefault(); }
    });
  }

  function init() {
    band = document.querySelector('#home-view .band.land') || document.querySelector('.band[aria-labelledby="hello-t"]');
    if (!band || band.classList.contains('axm')) return;
    var st = document.createElement('style'); st.id = 'axm-css'; st.textContent = CSS; document.head.appendChild(st);
    scene = document.createElement('div'); scene.className = 'am-scene'; scene.setAttribute('aria-hidden', 'true'); scene.innerHTML = sceneHTML();
    band.insertBefore(scene, band.firstChild);
    band.classList.add('axm', 'am-objdim');
    city = scene.querySelector('.am-city'); sunEl = scene.querySelector('.am-sun'); steam = scene.querySelector('.am-mug .st'); mug = scene.querySelector('.am-mug');
    var stars = scene.querySelector('.am-stars'); seed = 20261021;
    for (var i = 0; i < 110; i++) { var c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', (R() * 1600).toFixed(0)); c.setAttribute('cy', (R() * 380).toFixed(0)); c.setAttribute('r', (R() * 1.3 + .4).toFixed(1)); c.style.animationDelay = (-R() * 4).toFixed(2) + 's'; stars.appendChild(c); }
    picker(); modeSwitch();
    // takvim başlığı: ay ve yıl
    var br = band.querySelector('.band-r'), nowD = new Date();
    if (br) br.setAttribute('data-am-month', nowD.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }).toLocaleUpperCase('tr'));
    // kupadaki baş harf: selamdaki ad ("iyi çalışmalar, Suko" → S)
    var ini = scene.querySelector('.am-ini'), gr = band.querySelector('[data-greet]');
    var setIni = function () {
      var t = gr ? gr.textContent : '', n = t.indexOf(',') > -1 ? t.split(',').pop().trim() : '';
      var ch = n ? n.charAt(0).toLocaleUpperCase('tr') : 'A';
      if (ini.textContent !== ch) ini.textContent = ch;
    };
    setIni(); if (gr && 'MutationObserver' in window) new MutationObserver(setIni).observe(gr, { childList: true, characterData: true, subtree: true });
    setCity(store.get('axm-city') || 'ankara', false);
    layout(); parallax();
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(function () { layout(); }); ro.observe(band); var bl = band.querySelector('.band-l'); bl && ro.observe(bl); }
    else window.addEventListener('resize', layout);
    if ('MutationObserver' in window) new MutationObserver(layout).observe(band, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    setMode(store.get('axm-mode') || 'manzara', false);
    setInterval(apply, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) apply(); });
  }

  window.axMasa = { setCity: function (k) { setCity(k, true); }, cities: ORDER.slice(), setMode: function (m) { setMode(m, true); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
