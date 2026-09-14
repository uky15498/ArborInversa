// 从 index.html 里抽出「树 ⇄ 文本代码」的**真实实现**，供 Node 侧工具复用
// —— 工具生成/解析出来的代码，因此与页面里跑的完全一致（不另写一份）。
//
// 用法：
//   const { loadCodec } = require('./codec-from-html');
//   const { treeToCode, codeToTree, leavesOf } = loadCodec();
const fs = require('fs'), path = require('path');

function loadCodec(htmlPath) {
  const html = htmlPath || path.join(__dirname, '..', 'index.html');
  const src = fs.readFileSync(html, 'utf8');

  const m = src.match(/function leavesOf\(n\)\{[\s\S]*?\n\}/);
  if (!m) throw new Error('index.html 里找不到 leavesOf()');

  const BEGIN = '// ==== 树 ⇄ 文本代码 BEGIN';
  const END = '// ==== 树 ⇄ 文本代码 END ====';
  const a = src.indexOf(BEGIN), b = src.indexOf(END);
  if (a < 0 || b < a) throw new Error('index.html 里找不到编解码标记');

  const codec = src.slice(a, b + END.length);
  return new Function(m[0] + '\n' + codec + '\nreturn {leavesOf, treeToCode, codeToTree};')();
}

module.exports = { loadCodec };
