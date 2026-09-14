// 从当前应用数据里抽出「中国美术史」整棵树，写成试用用的代码文档
// 用法：node tools/make_trial_code.js [输出路径]
//  - 源数据默认 /mnt/c/ArborInversa/data.json（可用环境变量 DATA 覆盖）
//  - 输出为 UTF-8 带 BOM、CRLF 换行（方便记事本直接打开、复制）
//  - 编解码实现取自 index.html 本身（见 tools/codec-from-html.js），与页面里跑的完全一致
const fs = require('fs'), path = require('path');
const { loadCodec } = require('./codec-from-html');

const SRC = process.env.DATA || '/mnt/c/ArborInversa/data.json';
const BRANCH = process.env.BRANCH || '中国美术史';
const OUT = process.argv[2] || path.join(__dirname, '..', 'dist', '美术史树-试用.txt');

const { treeToCode, codeToTree } = loadCodec();

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const node = (data.children || []).find(c => c.name === BRANCH);
if (!node) throw new Error(`数据里找不到枝「${BRANCH}」`);

const code = treeToCode(node);
// 自检：生成的代码必须能原样解析回来
const back = codeToTree(code);
if (!back.children.length || back.children[0].name !== BRANCH) throw new Error('生成结果自检失败');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, '\uFEFF' + code.replace(/\n/g, '\r\n'), 'utf8');

let branches = 0, leaves = 0;
(function walk(n) { branches++; leaves += leavesOfOf(n).length; (n.children || []).forEach(walk); })(node);
function leavesOfOf(n) { return (n.leaves && n.leaves.length) ? n.leaves : [{ name: '概述', desc: '' }]; }
console.log(`✓ 试用代码：${OUT}`);
console.log(`  枝 ${branches}｜叶 ${leaves}｜${code.split('\n').length} 行｜${fs.statSync(OUT).size} 字节`);
