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

function fingerprint(src) {
  const js = ts.transpileModule(src, {
    fileName: 'x.ts',
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: true }
  }).outputText;
  const sf = ts.createSourceFile('x.js', js, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const out = [];
  const walk = (node) => {
    if (ts.isParenthesizedExpression(node)) return walk(node.expression);
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
  return crypto.createHash('sha256').update(out.join('\u0001')).digest('hex');
}

module.exports = { fingerprint };
if (require.main === module) {
  for (const f of process.argv.slice(2)) {
    let h = 'okunamadi';
    try { h = fingerprint(fs.readFileSync(f, 'utf8')); } catch (e) { h = 'hata'; }
    console.log(`${h} ${f}`);
  }
}
