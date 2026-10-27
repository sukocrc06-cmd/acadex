// Kod parmak izi: TypeScript'i JavaScript'e çevirir ve sözdizimi ağacını
// biçimden bağımsız bir diziye döker (boşluk, yorum, noktalı virgül, virgül
// ve fazladan parantez sayılmaz; tür bildirimleri atılır). Supabase'den
// indirilen kod derlenmiş JS olarak geldiği için iki taraf da aynı yoldan
// geçirilir. Kullanım: node code-fingerprint.cjs dosya... → her satıra
// "<sha256> <dosya>".
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');

function tokens(src) {
  const js = ts.transpileModule(src, {
    fileName: 'x.ts',
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: true }
  }).outputText;
  const sf = ts.createSourceFile('x.js', js, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const out = [];
  const walk = (node) => {
    if (ts.isParenthesizedExpression(node)) return walk(node.expression);
    // Derleyici tek deyimlik gövdeleri süslü paranteze alabiliyor
    // ("if (x) for (…)" → "if (x) { for (…) }", canlı tanı 27.10.2026);
    // blok ve boş deyim yapıya sayılmaz.
    if (node.kind === ts.SyntaxKind.EmptyStatement) return;
    if (ts.isBlock(node)) { ts.forEachChild(node, walk); return; }
    out.push(ts.SyntaxKind[node.kind]);
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) out.push(node.text);
    else if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isBigIntLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) || ts.isRegularExpressionLiteral(node)) out.push(JSON.stringify(node.text));
    else if (ts.isBinaryExpression(node)) out.push(ts.SyntaxKind[node.operatorToken.kind]);
    else if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) out.push(ts.SyntaxKind[node.operator]);
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}

function fingerprint(src) {
  return crypto.createHash('sha256').update(tokens(src).join('\u0001')).digest('hex');
}

/** Tanı: canlı dosyayı adaylarla karşılaştırır; en uzun ortak başlangıcı
 *  olan adayla ilk farkın çevresini yazar. */
function explain(liveFile, candidates) {
  const live = tokens(fs.readFileSync(liveFile, 'utf8'));
  let best = null;
  for (const c of candidates) {
    const t = tokens(fs.readFileSync(c, 'utf8'));
    let i = 0;
    while (i < live.length && i < t.length && live[i] === t[i]) i++;
    if (!best || i > best.i) best = { i, t, c };
  }
  if (!best) return;
  const show = (arr) => arr.slice(Math.max(0, best.i - 12), best.i + 12).map(x => String(x).slice(0, 80)).join(' | ');
  console.log(`ilk fark: ${best.i}. öğe (canlı ${live.length}, aday ${best.t.length} öğe; aday ${best.c.split('/').pop()})`);
  console.log(`  git  : ${show(best.t)}`);
  console.log(`  canlı: ${show(live)}`);
}

module.exports = { fingerprint, tokens };
if (require.main === module && process.argv[2] === '--explain') {
  explain(process.argv[3], process.argv.slice(4));
} else if (require.main === module) {
  for (const f of process.argv.slice(2)) {
    let h = 'okunamadi';
    try { h = fingerprint(fs.readFileSync(f, 'utf8')); } catch (e) { h = 'hata'; }
    console.log(`${h} ${f}`);
  }
}
