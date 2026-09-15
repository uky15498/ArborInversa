// 从 index.html 里抽出「纯函数区」的**真实实现**，供 Node 侧工具复用
// —— 工具算出来、测出来的，因此与页面里跑的完全是同一份代码（不另写一份、也不抄一份）。
//
// 纯函数区的边界由 index.html 里的标记定：
//     // ==== 纯函数区 BEGIN：<说明> ====
//     ...
//     // ==== 纯函数区 END ====
// 凡是不碰 DOM 的部分（数据 helpers、树 ⇄ 文本代码、搜索引擎）都标在这个区里；
// 页面上可能有多段，这里全部收集起来拼成一份。
//
// 用法：
//   const { loadPure, loadCodec } = require('./codec-from-html');
//   const { treeToCode, codeToTree, leavesOf } = loadCodec();   // 只要编解码
//   const src = loadPure();                                      // 要自己挑函数时
const fs = require('fs'), path = require('path');

const BEGIN = /\/\/ ==== 纯函数区 BEGIN[^\n]*====\n/g;
const END = '// ==== 纯函数区 END ====';

function loadPure(htmlPath) {
  const html = htmlPath || path.join(__dirname, '..', 'index.html');
  const src = fs.readFileSync(html, 'utf8');

  const out = [];
  BEGIN.lastIndex = 0;
  let m;
  while ((m = BEGIN.exec(src)) !== null) {
    const i = m.index + m[0].length;
    const j = src.indexOf(END, i);
    if (j < 0) throw new Error('index.html 里「纯函数区 BEGIN」没有对应的 END');
    out.push(src.slice(i, j));
  }
  if (!out.length) throw new Error('index.html 里找不到「纯函数区 BEGIN/END」标记');
  return out.join('\n');
}

function loadCodec(htmlPath) {
  return new Function(loadPure(htmlPath) + '\nreturn {leavesOf, treeToCode, codeToTree};')();
}

module.exports = { loadPure, loadCodec };
