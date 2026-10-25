/* ==========================================================================
   ACADEX — GRAFİK ÇİZME TESTLERİ (tests/exam-graph.js)

   Faz 4b (24.10.2026): öğrenci cevabı ızgarada çizer ya da yazarak girer.
     - generate-exam verifyGraph: ızgara, verilenler ve cevap kodla
       hesaplanır (kesişim, doğru üstünde nokta); ızgaraya oturmayan atılır.
     - grade-exam gradeGraph: öğe öğe kodla puanlama, kısmi puan, etiket,
       çizgi türü, fazladan çizim, tekrar.
     - js/exam-engine.js: yazarak giriş, durum ↔ JSON, çizim yardımcıları.
     - Üç taraf aynı kuralı izler (bölge boyama, kaydırma yönü).

   Çalıştırma:  node tests/exam-graph.js
   ========================================================================== */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { loadFromSource, makeRunner } = require('./_ts-extract.js');

const GEN = 'supabase/functions/generate-exam/index.ts';
const GRADE = 'supabase/functions/grade-exam/index.ts';
const G = loadFromSource(GEN, [
  'EXPR_MAX_LENGTH', 'EXPR_MAX_DEPTH', 'EXPR_CONSTS', 'EXPR_FUNCS', 'evaluateExpression', 'parseLooseNumber', 'MATH_INPUT_MAX', 'normalizeMathInput', 'chartLabel',
  'GRAPH_KINDS', 'GRAPH_TOOL_ORDER', 'GRAPH_MAX_STEPS', 'GRAPH_MAX_ELEMENTS', 'GRAPH_MAX_GIVEN', 'GRAPH_SHIFT_DIRS', 'graphRound', 'normalizeGraphAxis',
  'graphLinear', 'graphInequality', 'graphInBox', 'graphOnGrid', 'graphLineOf', 'graphClipLine', 'graphGridPointsOnLine', 'graphRef', 'graphResolvePoint',
  'GRAPH_KIND_ALIASES', 'graphMapAxisVars', 'normalizeGraphObject', 'graphIneqHolds', 'graphShiftDir', 'graphElementSnap', 'graphNum', 'graphLineText', 'graphPointText',
  'GRAPH_KIND_NAMES', 'graphAnswerText', 'GRAPH_SOURCE_CUES', 'sourceTeachesGraphs', 'graphSameLine', 'GRAPH_EQ_TERM', 'GRAPH_EQ_RE', 'graphEquationsIn', 'verifyGraph', 'allowedTypesFor', 'KEY_FIELDS', 'INTERNAL_FIELDS', 'splitPublicAndKey'
]);
const R = loadFromSource(GRADE, ['GRAPH_STUDENT_MAX_OBJECTS', 'GRAPH_STUDENT_KINDS', 'graphParseStudent', 'graphLabelKey', 'GRAPH_EL_NAMES', 'graphFmt',
  'graphFmtPt', 'graphScaled', 'graphDistToLine', 'graphAngle', 'graphShiftOf', 'graphInPolygon', 'graphIqHolds', 'graphInStudentFill', 'graphCredit', 'gradeGraph']);
const E = require(path.join(__dirname, '..', 'js', 'exam-engine.js'));

const { test, summary } = makeRunner();

const market = () => ({
  type: 'graph', question: 'Talep P = 12 − 2Q, arz P = 3 + Q. Doğruları çizip dengeyi E ile işaretleyiniz.',
  graph: { x: { min: 0, max: 8, step: 1, label: 'Miktar (Q)' }, y: { min: 0, max: 14, step: 1, label: 'Fiyat (P)' } },
  graph_answer: [{ kind: 'line', equation: 'y = 12 - 2*x', label: 'D' }, { kind: 'line', equation: 'y = 3 + x', label: 'S' }, { kind: 'point', at: { intersect: ['a0', 'a1'] }, label: 'E' }]
});
const shift = () => ({
  type: 'graph', question: 'Gelir artınca talep sağa kayar. Yeni talebi çiziniz.',
  graph: { x: { min: 0, max: 10, step: 1, label: 'Q' }, y: { min: 0, max: 10, step: 1, label: 'P' }, given: [{ kind: 'line', equation: 'y = 8 - x', label: 'D1' }] },
  graph_answer: [{ kind: 'line', shift_of: 'g0', direction: 'right', label: 'D2' }]
});
const region = () => ({
  type: 'graph', question: 'y < −x + 4 bölgesini tarayınız.',
  graph: { x: { min: -5, max: 5, step: 1 }, y: { min: -5, max: 5, step: 1 } },
  graph_answer: [{ kind: 'line', equation: 'y = -x + 4', style: 'dashed' }, { kind: 'fill', inequalities: ['y < -x + 4'] }]
});
const verified = q => { const v = G.verifyGraph(q, 'tr'); assert.equal(v.ok, true, v.reason); return q; };
const S = o => JSON.stringify({ v: 1, o });

test('verifyGraph: denklemden doğru, kesişimi kod hesaplar, eksen harfi etiketten', () => {
  const q = verified(market());
  assert.deepEqual(q.graph_answer.elements.map(e => e.points), [[[0, 12], [6, 0]], [[0, 3], [8, 11]], [[3, 6]]]);
  assert.equal(q.graph.x.var, 'Q');
  assert.equal(q.graph.y.var, 'P');
  assert.deepEqual(q.graph.tools, ['point', 'line']);
  assert.deepEqual(q.graph.labels, ['D', 'E', 'S']);
  assert.equal(q.correct_answer, 'Doğru D: P = −2Q + 12 · Doğru S: P = Q + 3 · Nokta E (3; 6)');
  assert.equal(q.options, null);
  // cevap anahtarda, ızgara tarayıcıda
  const { pub, key } = G.splitPublicAndKey(q);
  assert.ok(pub.graph && !pub.graph_answer && !pub.correct_answer);
  assert.ok(key.graph_answer && key.correct_answer);
});

test('verifyGraph: kaydırma, bölge, alan (başvurulu köşeler), parabol, çember', () => {
  const s = verified(shift());
  assert.deepEqual(s.graph_answer.elements[0].shift, { of: 0, dir: 'right' });
  assert.ok(s.graph.tools.includes('shift'));
  assert.equal(s.graph.x.var, 'Q');
  const r = verified(region());
  assert.ok(r.graph.tools.includes('fill') && r.graph.tools.includes('line'));
  assert.equal(r.graph_answer.elements[0].style, 'dashed');
  assert.equal(r.graph_answer.elements[1].ineq[0].op, '<');
  const cs = verified({ type: 'graph', question: 'Tüketici artığı', graph: { x: { min: 0, max: 8, step: 1 }, y: { min: 0, max: 14, step: 1 }, given: [{ kind: 'line', equation: 'y = 12 - 2*x' }, { kind: 'line', equation: 'y = 6' }] },
    graph_answer: [{ kind: 'polygon', points: [{ on: 'g0', x: 0 }, { intersect: ['g0', 'g1'] }, [0, 6]] }] });
  assert.deepEqual(cs.graph_answer.elements[0].points, [[0, 12], [3, 6], [0, 6]]);
  const p = verified({ type: 'graph', question: 'Parabol', graph: { x: { min: -4, max: 4, step: 1 }, y: { min: -2, max: 10, step: 1 } }, graph_answer: [{ kind: 'parabola', vertex: [1, -1], through: [3, 3] }] });
  assert.ok(p.graph.tools.includes('parabola'));
  const c = verified({ type: 'graph', question: 'Çember', graph: { x: { min: -6, max: 6, step: 1 }, y: { min: -6, max: 6, step: 1 } }, graph_answer: [{ kind: 'circle', center: [1, 1], through: [4, 1] }] });
  assert.match(c.correct_answer, /merkez \(1; 1\), r = 3/);
  const none = verified({ type: 'graph', question: 'Çözüm yok', graph: { x: { min: 0, max: 5, step: 1 }, y: { min: 0, max: 5, step: 1 } }, graph_answer: 'none' });
  assert.equal(none.graph_answer.none, true);
});

test('verifyGraph: ızgaraya oturmayan, bozuk eksen, hatalı kaydırma atılır; yarım adım gerekirse yapışma yarıya iner', () => {
  const off = { type: 'graph', question: 'x', graph: { x: { min: 0, max: 8, step: 1 }, y: { min: 0, max: 14, step: 1 } }, graph_answer: [{ kind: 'line', equation: 'y = 12 - 2*x' }, { kind: 'line', equation: 'y = 2 + 1.3*x' }, { kind: 'point', at: { intersect: ['a0', 'a1'] } }] };
  assert.deepEqual(G.verifyGraph(off, 'tr'), { ok: false, reason: 'graph_off_grid' });
  assert.equal(G.verifyGraph({ type: 'graph', question: 'x', graph: { x: { min: 0, max: 100, step: 1 }, y: { min: 0, max: 5, step: 1 } }, graph_answer: [{ kind: 'point', at: [1, 1] }] }, 'tr').reason, 'graph_axes_invalid');
  assert.equal(G.verifyGraph({ type: 'graph', question: 'x', graph: { x: { min: 0, max: 5, step: 1 }, y: { min: 0, max: 5, step: 1 } }, graph_answer: [] }, 'tr').reason, 'graph_no_answer');
  const bad = shift(); bad.graph_answer = [{ kind: 'line', shift_of: 'g0', direction: 'right', equation: 'y = 6 - x' }];
  assert.equal(G.verifyGraph(bad, 'tr').reason, 'graph_shift_wrong_dir');
  const np = shift(); np.graph_answer = [{ kind: 'line', shift_of: 'g0', direction: 'right', equation: 'y = 12 - 2*x' }];
  assert.equal(G.verifyGraph(np, 'tr').reason, 'graph_shift_not_parallel');
  const half = verified({ type: 'graph', question: 'x', graph: { x: { min: 0, max: 6, step: 1 }, y: { min: 0, max: 6, step: 1 } }, graph_answer: [{ kind: 'point', at: [2.5, 3] }] });
  assert.equal(half.graph.x.snap, 0.5);
  assert.equal(half.graph.y.snap, 0.5);
});

test('sourceTeachesGraphs: arz-talep / doğrusal fonksiyon notu evet; sözel ya da yalnızca "grafik" geçen not hayır (canlı test 25.10.2026)', () => {
  assert.equal(G.sourceTeachesGraphs('Talep doğrusu negatif eğimlidir. Doğrusal talep fonksiyonu P = 12 - 2Q; arz P = 3 + Q. Piyasa dengesi kesişim noktasıdır.'), true);
  assert.equal(G.sourceTeachesGraphs('Bütçe kısıtı 2x + y ≤ 8 eşitsizliğiyle gösterilir; bütçe doğrusu y = 8 - 2x.'), true);
  assert.equal(G.sourceTeachesGraphs('Demand and supply determine the equilibrium price; the demand curve P = 20 - Q has a negative slope.'), true);
  assert.equal(G.sourceTeachesGraphs('Sınavlarda grafik soruları genellikle yorum bazlıdır; sütun grafiği kategorileri karşılaştırır.'), false);
  assert.equal(G.sourceTeachesGraphs('Talep ve arz kavramları ile piyasa dengesi sözel olarak anlatılır.'), false, 'denklem izi yok');
  assert.equal(G.sourceTeachesGraphs('Fırsat maliyeti, vazgeçilen en iyi seçenektir. NPV = 120 TL.'), false);
});

test('verifyGraph: verilen ve cevap denklemleri eksen harfleriyle (P = 8 − Q) de okunur (canlı test 25.10.2026)', () => {
  const q = verified({ type: 'graph', question: 'Talep sağa kayar.', graph: { x: { min: 0, max: 10, step: 1, label: 'Miktar (Q)' }, y: { min: 0, max: 10, step: 1, label: 'Fiyat (P)' }, given: [{ kind: 'line', equation: 'P = 8 - Q', label: 'D1' }] },
    graph_answer: [{ kind: 'line', equation: 'P = 10 - Q', shift_of: 'g0', direction: 'right', label: 'D2' }, { kind: 'region', inequalities: ['P <= 10 - Q', 'Q >= 0'] }] });
  assert.deepEqual(q.graph.given[0].points, [[0, 8], [8, 0]]);
  assert.deepEqual(q.graph_answer.elements[0].points, [[0, 10], [10, 0]]);
  assert.equal(q.graph_answer.elements[1].ineq.length, 2);
  const bad = G.verifyGraph({ type: 'graph', question: 'x', graph: { x: { min: 0, max: 10, step: 1 }, y: { min: 0, max: 10, step: 1 }, given: [{ kind: 'line', equation: 'y = 50 + x' }] }, graph_answer: [{ kind: 'point', at: [1, 1] }] }, 'tr');
  assert.equal(bad.reason, 'graph_given_invalid:graph_line_invalid', 'iç neden de yazılır');
});

test('verifyGraph: denge noktası doğruların gerçek kesişimi olmalı (canlı test 25.10.2026)', () => {
  const live = { type: 'graph', question: "Talep P = 12 - 2Q ve arz P = 3 + Q verilmiştir. Gelir artışıyla talep P' = 14 - 2Q olur. Yeni denge noktasını işaretleyiniz.",
    graph: { x: { min: 0, max: 10, step: 1, label: 'Miktar (Q)' }, y: { min: 0, max: 15, step: 1, label: 'Fiyat (P)' }, given: [{ kind: 'line', equation: 'P = 12 - 2Q' }, { kind: 'line', equation: 'P = 3 + Q' }] },
    graph_answer: [{ kind: 'line', equation: 'y = 14 - 2*x' }, { kind: 'point', at: [4, 4], label: "E'" }] };
  assert.equal(G.verifyGraph(live, 'tr').reason, 'graph_point_not_intersection');
  const viaIntersect = { ...live, graph_answer: [{ kind: 'line', equation: 'y = 14 - 2*x' }, { kind: 'point', at: { intersect: ['a0', 'g1'] }, label: "E'" }] };
  assert.equal(G.verifyGraph(viaIntersect, 'tr').reason, 'graph_off_grid', '(3,67; 6,67) ızgaraya oturmuyor');
  const good = verified({ ...live, question: 'Talep P = 15 - 2Q olursa yeni denge?', graph_answer: [{ kind: 'line', equation: 'y = 15 - 2*x' }, { kind: 'point', at: [4, 7], label: "E'" }] });
  assert.deepEqual(good.graph_answer.elements[1].points, [[4, 7]], 'elle yazılmış ama doğru kesişim kabul');
  const plain = verified({ type: 'graph', question: 'A(2; 3) noktasını işaretleyiniz.', graph: { x: { min: 0, max: 5, step: 1 }, y: { min: 0, max: 5, step: 1 } }, graph_answer: [{ kind: 'point', at: [2, 3], label: 'A' }] });
  assert.ok(plain, 'denge sorulmayan sıradan nokta etkilenmez');
});

test('gradeGraph: verilen doğruyu yeniden çizmek fazladan sayılmaz', () => {
  const q = verified({ type: 'graph', question: 'Talep sağa kayar; yeni talebi çiziniz.', graph: { x: { min: 0, max: 10, step: 1, label: 'Q' }, y: { min: 0, max: 10, step: 1, label: 'P' }, given: [{ kind: 'line', equation: 'y = 8 - x' }] },
    graph_answer: [{ kind: 'line', equation: 'y = 10 - x' }] });
  const r = R.gradeGraph(S([{ k: 'line', p: [[0, 8], [8, 0]] }, { k: 'line', p: [[0, 10], [10, 0]] }]), q, true);
  assert.equal(r.extra, 0);
  assert.equal(r.score, 100);
  const r2 = R.gradeGraph(S([{ k: 'line', p: [[0, 10], [10, 0]] }, { k: 'point', p: [[1, 1]] }]), q, true);
  assert.equal(r2.extra, 1, 'başka fazladan çizim yine sayılır');
});

test('allowedTypesFor: çizim karışık ve hesaplamada, "grafik sorusu olmasın" ise yok', () => {
  assert.ok(G.allowedTypesFor('mixed', false, true).includes('graph'));
  assert.ok(G.allowedTypesFor('calculation', true, true).includes('graph'));
  assert.ok(!G.allowedTypesFor('mixed', true, false).includes('graph'));
  assert.ok(!G.allowedTypesFor('test', true, true).includes('graph'));
  assert.ok(!G.allowedTypesFor('classic', true, true).includes('graph'));
  assert.deepEqual(G.allowedTypesFor('calculation', true), ['calculation', 'expression'], 'eski çağrı değişmedi');
});

test('gradeGraph: aynı doğrudan geçen herhangi iki nokta doğru; etiket, kısmi puan, fazladan çizim', () => {
  const q = verified(market());
  const full = R.gradeGraph(S([{ k: 'line', p: [[1, 10], [4, 4]], l: 'D' }, { k: 'line', p: [[1, 4], [5, 8]], l: 'S' }, { k: 'point', p: [[3, 6]], l: 'E' }]), q, true);
  assert.equal(full.score, 100);
  const swapped = R.gradeGraph(S([{ k: 'line', p: [[1, 10], [4, 4]], l: 'S' }, { k: 'line', p: [[1, 4], [5, 8]], l: 'D' }, { k: 'point', p: [[3, 5]], l: 'E' }]), q, true);
  assert.equal(swapped.score, 50, 'etiketler ters (½ + ½) ve nokta yalnızca x doğru (½)');
  assert.match(swapped.elements[0].note, /etiketi D olmalıydı/);
  const extra = R.gradeGraph(S([{ k: 'segment', p: [[0, 12], [6, 0]], l: 'D' }, { k: 'line', p: [[0, 4], [8, 12]], l: 'S' }, { k: 'point', p: [[3, 6]], l: 'E' }, { k: 'point', p: [[1, 1]] }]), q, true);
  assert.equal(extra.extra, 1);
  assert.equal(extra.score, Math.round(100 * 2.5 / 4), 'eğim doğru ama kaymış S yarım; fazladan nokta paydayı büyütür');
  assert.match(extra.elements[1].note, /eğim doğru/);
  const dup = R.gradeGraph(S([{ k: 'line', p: [[1, 10], [4, 4]], l: 'D' }, { k: 'line', p: [[1, 10], [4, 4]], l: 'D' }, { k: 'line', p: [[1, 4], [5, 8]], l: 'S' }, { k: 'point', p: [[3, 6]], l: 'E' }]), q, true);
  assert.equal(dup.score, 100, 'aynı nesneyi iki kez çizmek ceza değil');
  assert.equal(R.gradeGraph('', q, true).score, 0);
  assert.equal(R.gradeGraph('bozuk{', q, true).score, 0);
});

test('gradeGraph: kaydırma yönü, kesikli sınır, bölge, alan, parabol, çözüm yok', () => {
  const s = verified(shift());
  assert.equal(R.gradeGraph(S([{ k: 'line', p: [[0, 10], [10, 0]], l: 'D2' }]), s, true).score, 100);
  const left = R.gradeGraph(S([{ k: 'line', p: [[0, 6], [6, 0]], l: 'D2' }]), s, true);
  assert.equal(left.score, 0);
  assert.equal(left.extra, 0, 'yanlış deneme fazladan sayılmaz');
  assert.match(left.elements[0].note, /sağa kaymalıydı/);
  assert.equal(R.gradeGraph(S([{ k: 'line', p: [[0, 10], [5, 0]], l: 'D2' }]), s, true).score, 0, 'eğimi değişip sola kalan');
  assert.equal(R.gradeGraph(S([{ k: 'line', p: [[0, 14], [7, 0]], l: 'D2' }]), s, true).score, 50, 'sağa ama eğim değişmiş');
  const r = verified(region());
  assert.equal(R.gradeGraph(S([{ k: 'line', p: [[0, 4], [4, 0]], d: 1 }, { k: 'fill', p: [[0, 0]] }]), r, true).score, 100);
  const solid = R.gradeGraph(S([{ k: 'line', p: [[0, 4], [4, 0]] }, { k: 'fill', p: [[0, 0]] }]), r, true);
  assert.equal(solid.score, Math.round(100 * 1.75 / 2));
  assert.match(solid.elements[0].note, /kesikli/);
  const wrong = R.gradeGraph(S([{ k: 'line', p: [[0, 4], [4, 0]], d: 1 }, { k: 'fill', p: [[4, 4]] }]), r, true);
  assert.match(wrong.elements[1].note, /yanlış bölge/);
  const cs = verified({ type: 'graph', question: 'artık', graph: { x: { min: 0, max: 8, step: 1 }, y: { min: 0, max: 14, step: 1 } }, graph_answer: [{ kind: 'polygon', points: [[0, 12], [3, 6], [0, 6]] }] });
  assert.equal(R.gradeGraph(S([{ k: 'polygon', p: [[3, 6], [0, 6], [0, 12]] }]), cs, true).score, 100, 'köşe sırası önemsiz');
  assert.equal(R.gradeGraph(S([{ k: 'polygon', p: [[0, 12], [4, 6], [0, 6]] }]), cs, true).score, 50);
  const p = verified({ type: 'graph', question: 'parabol', graph: { x: { min: -4, max: 4, step: 1 }, y: { min: -2, max: 10, step: 1 } }, graph_answer: [{ kind: 'parabola', vertex: [1, -1], through: [3, 3] }] });
  assert.equal(R.gradeGraph(S([{ k: 'parabola', p: [[1, -1], [2, 0]] }]), p, true).score, 100, 'aynı parabolün başka noktası');
  assert.equal(R.gradeGraph(S([{ k: 'parabola', p: [[1, -1], [2, 1]] }]), p, true).score, 50);
  const none = verified({ type: 'graph', question: 'yok', graph: { x: { min: 0, max: 5, step: 1 }, y: { min: 0, max: 5, step: 1 } }, graph_answer: 'none' });
  assert.equal(R.gradeGraph(JSON.stringify({ v: 1, o: [], none: true }), none, true).score, 100);
  assert.equal(R.gradeGraph(S([{ k: 'point', p: [[1, 1]] }]), none, true).score, 0);
  assert.equal(R.gradeGraph(JSON.stringify({ v: 1, o: [], none: true }), verified(market()), true).score, 0);
});

test('tarayıcı: yazarak giriş (eksen harfleriyle), durum ↔ JSON, denklem metni', () => {
  const q = verified(market());
  const spec = E.graphSpecOf(q);
  const P = (t, tool) => E.graphParseTyped(t, spec, tool || 'line', 'tr');
  assert.deepEqual(P('P = 12 - 2Q').obj.p, [[0, 12], [6, 0]]);
  assert.equal(P('D: P = 12 - 2Q').obj.l, 'D');
  assert.deepEqual(P('E(3; 6)').obj, { k: 'point', p: [[3, 6]], l: 'E', d: 0, g: null });
  assert.deepEqual(P('(2,5; 4)').obj.p, [[2.5, 4]]);
  assert.deepEqual(P('(0; 12) (6; 0)').obj.p, [[0, 12], [6, 0]]);
  assert.equal(P('(0; 12) (6; 0)', 'segment').obj.k, 'line', 'parça aracı yoksa doğru');
  assert.deepEqual(P('Q = 4').obj.p, [[4, 0], [4, 14]]);
  assert.ok(P('y < 3').error);
  assert.ok(P('rastgele').error);
  const st = { o: [{ k: 'line', p: [[0, 12], [6, 0]], l: 'D', d: 0, g: null }, { k: 'point', p: [[3, 6]], l: '', d: 1, g: null }], none: false };
  const back = E.graphParseState(E.graphSerialize(st));
  assert.deepEqual(back.o.map(o => [o.k, o.p, o.l, o.d]), [['line', [[0, 12], [6, 0]], 'D', 0], ['point', [[3, 6]], '', 1]]);
  assert.equal(E.graphSerialize({ o: [], none: false }), '', 'boş cevap = boş dize (cevaplanmadı)');
  assert.equal(E.graphLineEq([[0, 12], [6, 0]], spec, 'tr'), 'P = −2Q + 12');
  assert.equal(E.graphLineEq([[4, 0], [4, 1]], spec, 'tr'), 'Q = 4');
  // tarayıcının yazdığı cevap sunucuda aynı biçimde okunur
  const typed = [P('D: P = 12 - 2Q').obj, P('S: P = 3 + Q').obj, P('E(3; 6)').obj];
  assert.equal(R.gradeGraph(E.graphSerialize({ o: typed, none: false }), q, true).score, 100);
});

test('üç taraf aynı kural: boyanan hücre ve kaydırma yönü', () => {
  const spec = { x: { min: -5, max: 5, step: 1, snap: 1 }, y: { min: -5, max: 5, step: 1, snap: 1 } };
  const lines = [[[0, 4], [4, 0]], [[-5, -2], [5, 3]]];
  const poly = E.graphFillPoly([0, 0], lines, spec);
  const inPoly = (p, pl) => { let ins = false; for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) { const a = pl[i], b = pl[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; };
  for (let i = 0; i < 25; i++) for (let j = 0; j < 25; j++) {
    const p = [-5 + (i + 0.5) * 0.4, -5 + (j + 0.5) * 0.4];
    assert.equal(inPoly(p, poly), R.graphInStudentFill(p[0], p[1], [0, 0], lines), `nokta ${p}`);
  }
  const ax = { min: 0, max: 10, step: 1, snap: 1 };
  for (const [base, moved, dir] of [[[[0, 8], [8, 0]], [[0, 10], [10, 0]], 'right'], [[[0, 8], [8, 0]], [[0, 6], [6, 0]], 'left'], [[[0, 5], [10, 5]], [[0, 7], [10, 7]], 'up'], [[[3, 0], [3, 10]], [[1, 0], [1, 10]], 'left']]) {
    assert.equal(G.graphShiftDir(base, moved, ax, ax), dir);
    assert.equal(R.graphShiftOf(base, moved, ax, ax), dir);
  }
});

test('tarayıcı: çizim ve sonuç kâğıdı HTML (NaN yok, tutamaklar, kesikli doğrusu)', () => {
  const q = verified(region());
  const html = E.getType('graph').renderInput(q, { esc: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'), math: s => s, lang: 'tr', name: 'answer-q-3' });
  assert.match(html, /data-axg-tool="fill"/);
  assert.match(html, /name="answer-q-3" class="axg-val"/);
  assert.ok(!/NaN|undefined/.test(html));
  const g = R.gradeGraph(S([{ k: 'line', p: [[0, 4], [4, 0]], d: 1 }, { k: 'fill', p: [[0, 0]] }]), q, true);
  const res = E.graphResultHtml({ graph: q.graph, graph_answer: q.graph_answer, graph_student: g.student, graph_elements: g.elements, graph_extra: 0 }, 'tr');
  assert.match(res, /axg-ok/);
  assert.match(res, /axg-st/);
  assert.match(res, /doğru bölge boyandı/);
  assert.ok(!/NaN|undefined/.test(res));
  assert.equal(E.graphAnswerSummary(S([{ k: 'line', p: [[0, 4], [4, 0]], d: 1 }]), q, 'tr'), 'Doğru: y = −x + 4');
});

test('verifyGraph: ogrencinin cizecegi dogru "given"da ise kaldirilir; kaydirma bazi kalir (FAZ 4b.2 canli test)', () => {
  const q = verified({ type: 'graph', question: 'Talep (D) ve arz (S) doğrularını çiziniz ve dengeyi E ile işaretleyiniz.',
    graph: { x: { min: 0, max: 10, step: 1, label: 'Miktar (Q)' }, y: { min: 0, max: 12, step: 1, label: 'Fiyat (P)' },
      given: [{ kind: 'line', label: 'D', equation: 'P = 10 - Q' }, { kind: 'line', label: 'S', points: [[0, 2], [10, 12]] }, { kind: 'line', equation: 'y = 4' }] },
    graph_answer: [{ kind: 'line', equation: 'y = 10 - x', label: 'D' }, { kind: 'line', equation: 'y = 2 + x', label: 'S' }, { kind: 'point', at: { intersect: ['a0', 'a1'] }, label: 'E' }] });
  assert.equal(q.graph.given.length, 1, 'yalnizca y = 4 kalir');
  assert.deepEqual(q.graph.given[0].points.map(p => p[1]), [4, 4]);
  assert.deepEqual(q.graph_answer.elements[2].points[0], [4, 6]);
  // kaydirma: baz dogru kalir, referans yeniden siralanir
  const s = verified({ type: 'graph', question: 'Talep arttı; yeni talep doğrusunu çiziniz.',
    graph: { x: { min: 0, max: 16, step: 1 }, y: { min: 0, max: 12, step: 1 },
      given: [{ kind: 'line', equation: 'y = 2' }, { kind: 'line', label: 'D', equation: 'y = 10 - x' }] },
    graph_answer: [{ kind: 'line', equation: 'y = 2' }, { kind: 'line', shift_of: 'g1', direction: 'right', equation: 'y = 14 - x', label: 'D2' }] });
  assert.equal(s.graph.given.length, 1);
  assert.equal(s.graph.given[0].label, 'D');
  assert.equal(s.graph_answer.elements[1].shift.of, 0);
});

test('graphEquationsIn: dosyadaki denklemler (kopya denetimi)', () => {
  assert.deepEqual(G.graphEquationsIn('Talep fonksiyonu P = 10 − Q ve arz fonksiyonu P = 2 + Q olarak verilmiştir.'), ['p=10-q', 'p=2+q']);
  assert.deepEqual(G.graphEquationsIn('2x + y ≤ 6 bütçe kısıtını sağlayan bölgeyi tarayınız.'), ['2x+y≤6']);
  assert.deepEqual(G.graphEquationsIn('$y = 2x - 2$ doğrusunu çizin; (0; 12) noktası.'), ['y=2x-2']);
  assert.deepEqual(G.graphEquationsIn('$P = 12 - 2\\,Q$ ve $2x + y \\le 8$'), ['p=12-2q', '2x+y≤8']);
  assert.deepEqual(G.graphEquationsIn('Doğrusal fonksiyon y = mx + n biçimindedir. Q = 3 iken.'), [], 'rakamsiz ya da cok kisa');
  const file = new Set(G.graphEquationsIn('Talep P = 10 − Q ve arz P = 2 + Q'));
  assert.ok(G.graphEquationsIn('Talep $P = 10 - Q$, arz $P = 4 + Q$').some(e => file.has(e)));
  assert.ok(!G.graphEquationsIn('Talep $P = 12 - Q$, arz $P = 4 + Q$').some(e => file.has(e)));
});

summary();
