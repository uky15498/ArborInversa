// 改动（diff → 勾选 → 落地）与编辑语言自测
// 用法：cd /home/elu/test/doc-tool/daosheng-tree && node tools/edit.test.js
// 特点：从 index.html 的纯函数区抽出**真实实现**来跑，不重写一份；夹具是现编的小树，不依赖任何内容文件。
//
// 这套要守住的其实是三条容易悄悄出错的事：
//   ① 叶的正文：按名字对齐着改 —— 漏写的叶原样不动，枝的顺序变了也不串位
//   ② 枝与属性：只写到的算「改」，没写到的原样保留（加法）；要删就用「株」整根覆盖
//   ③ 落地：只认勾选的那几项；找不到落点就跳过，绝不能改出半截
const assert = require('assert');
const { loadPure } = require('./codec-from-html');

const api = new Function(loadPure() + `
return {diffCodes, diffLeaves, diffSummary, 落地改动, treeToCodeRel, treeToCode,
        applyEdit, editParse, editPropOf, editTokenOf, codeToTree, leavesOf};`)();
const { diffCodes, diffLeaves, 落地改动, treeToCodeRel, applyEdit, editParse, codeToTree } = api;
const branchOf = code => codeToTree(code).children[0];   // 代码 → 一根枝（夹具都这么造）

let pass = 0, fail = 0;
function ok(title, fn) {
  try { fn(); console.log('  ✓ ' + title); pass++; }
  catch (e) { console.log('  ✗ ' + title + '\n      ' + (e && e.message)); fail++; }
}
const kinds = r => r.changes.map(c => c.kind + (c.name ? ':' + c.name : c.key ? ':' + c.key : ''));
const clone = x => JSON.parse(JSON.stringify(x));
const leafOf = (n, name) => (n.leaves || []).find(l => l.name === name);

console.log('一、叶正文的差异（按名字对齐）');

ok('正文改一行 → 一处改动，且差值里能看见被删与被加的行', () => {
  const d = diffLeaves('甲\n乙\n丙', '甲\n乙改\n丙');
  assert.strictEqual(d.replaceAll, undefined, '有 2 行相同就不该退化成整片重写');
  assert.strictEqual(d.hunks.length, 1);
  assert.deepStrictEqual(d.hunks[0].del.map(x => x.s), ['乙']);
  assert.deepStrictEqual(d.hunks[0].add.map(x => x.s), ['乙改']);
  assert.strictEqual(d.hunks[0].lead, 1, '前一行的定位数');
});
ok('正文完全一致 → 不算改动（含尾部空行与行尾空格）', () => {
  assert.strictEqual(diffLeaves('甲\n乙\n', '甲\n乙  '), null);
});
ok('只加一行 → 只有「加」没有「删」', () => {
  const d = diffLeaves('甲\n乙', '甲\n乙\n丙');
  assert.deepStrictEqual(d.hunks[0].del, []);
  assert.deepStrictEqual(d.hunks[0].add.map(x => x.s), ['丙']);
});
ok('删一行 → 只有「删」没有「加」', () => {
  const d = diffLeaves('甲\n乙\n丙', '甲\n丙');
  assert.deepStrictEqual(d.hunks[0].del.map(x => x.s), ['乙']);
  assert.deepStrictEqual(d.hunks[0].add, []);
});
ok('整段重写 → 老实说「整片换掉」，不硬凑小段', () => {
  const d = diffLeaves('甲\n乙', '子\n丑');
  assert.strictEqual(d.replaceAll, true);
  assert.ok(d.hunks[0].del.length && d.hunks[0].add.length);
});
ok('一处正文写了很多行 → 只算一处改动，不会刷出一串', () => {
  const a = Array.from({ length: 20 }, (_, i) => '行' + i).join('\n');
  const b = a.split('\n').map((l, i) => (i === 3 ? '改过的行' : l)).join('\n');
  const d = diffLeaves(a, b);
  assert.strictEqual(d.hunks.length, 1);
});

console.log('\n二、两棵枝比差异（AI 改完的全文）');

const CODE_A = [
  '枝 明',
  '  叶 概述',
  '    明代画坛分前后两期。',
  '  枝 绘画',
  '    属性 朝代: 明',
  '    叶 概述',
  '      山水、人物、花鸟三科都有发展。',
  '    枝 浙派',
  '      叶 概述',
  '        以戴进、吴作为首。',
  '      枝 戴进',
  '        叶 形势',
  '          宣德年间入画院。'
].join('\n');

ok('一字未改 → 零处改动', () => {
  const r = diffCodes(CODE_A, CODE_A);
  assert.deepStrictEqual(r.changes, []);
  assert.strictEqual(r.summary, '没有任何差别');
});
ok('改了正文、加了一片叶、加了一条属性 → 三种改动各就各位', () => {
  const B = CODE_A.replace('以戴进、吴作为首。', '以戴进、吴作为首，声名最盛。')
                  .replace('    属性 朝代: 明', '    属性 朝代: 明\n    属性 门类: 绘画')
                  .replace('      叶 概述\n        以戴进', '      叶 概述\n        以戴进');
  const B2 = B.replace('        以戴进、吴作为首，声名最盛。', '        以戴进、吴作为首，声名最盛。\n      叶 环\n        浙派前期代表。');
  const r = diffCodes(CODE_A, B2);
  const k = kinds(r);
  assert.ok(k.includes('prop:门类'), '应有加属性');
  assert.ok(k.includes('leafAdd:环'), '应有加叶');
  assert.ok(r.changes.some(c => c.kind === 'leaf' && c.name === '概述'), '应有改正文');
});
ok('少写了一整根枝 → 认得出是「删枝」，路径是父枝的路径', () => {
  const B = CODE_A.replace(/      枝 戴进\n        叶 形势\n          宣德年间入画院。\n?/, '');
  const r = diffCodes(CODE_A, B);
  const del = r.changes.find(c => c.kind === 'branchRemove');
  assert.ok(del, '应当识别出删枝');
  assert.strictEqual(del.name, '戴进');
  assert.strictEqual(del.path, '明 / 绘画 / 浙派');
});
ok('枝的顺序打乱 → 不算改动（按名字对齐，不认位置）', () => {
  const B = [
    '枝 明', '  枝 绘画', '    属性 朝代: 明', '    枝 浙派', '      叶 概述', '        以戴进、吴作为首。',
    '      枝 戴进', '        叶 形势', '          宣德年间入画院。',
    '    叶 概述', '      山水、人物、花鸟三科都有发展。',
    '  叶 概述', '    明代画坛分前后两期。'
  ].join('\n');
  const r = diffCodes(CODE_A, B);
  assert.deepStrictEqual(r.changes, []);
});
ok('同时有几片叶叫同一个名字 → 老实报「指不准」，不替人决定', () => {
  const A = '枝 甲\n  叶 概述\n    一\n  叶 概述\n    二';
  const B = '枝 甲\n  叶 概述\n    三\n';
  const r = diffCodes(A, B);
  assert.ok(r.conflicts.length >= 1, '重名的叶应当作为冲突交出去：' + JSON.stringify(r.conflicts));
  assert.ok(r.summary.indexOf('指不准') >= 0, r.summary);
});
ok('代码里出现两根以上的枝 → 直说比不了', () => {
  assert.throws(() => diffCodes(CODE_A, '枝 甲\n枝 乙'), /只能有一根枝/);
});
ok('摘要用中文点数，看得懂', () => {
  const B = CODE_A.replace('      枝 戴进', '      枝 吴伟\n        叶 概述\n          江夏派。\n      枝 戴进');
  const r = diffCodes(CODE_A, B);
  assert.strictEqual(r.summary, '加枝 1');
});

console.log('\n三、落地（只认勾选的项，落点找不到就跳过）');

ok('勾选的落下、没勾的不动', () => {
  const B = CODE_A.replace('以戴进、吴作为首。', '以戴进、吴作为首。\n      叶 环\n        浙派前期代表。');
  const r = diffCodes(CODE_A, B);
  const root = branchOf(CODE_A);
  const keep = clone(root);
  const picked = r.changes.map(c => c.kind === 'leafAdd');            // 只收「加叶」
  const res = 落地改动(root, r.changes, picked);
  assert.strictEqual(res.n, 1);
  assert.ok(leafOf(root.children[0].children[0], '环'), '该加的那片叶要加上');
  assert.deepStrictEqual(root.leaves, keep.leaves, '没勾的部分一个字节都不动');
});
ok('全勾 → 跟改好的全文一致（往返闭合）', () => {
  const B = CODE_A.replace('宣德年间入画院。', '宣德年间入画院，后归乡里。')
                  .replace('    属性 朝代: 明', '    属性 朝代: 明代\n    属性 门类: 绘画');
  const r = diffCodes(CODE_A, B);
  const root = branchOf(CODE_A);
  const res = 落地改动(root, r.changes, r.changes.map(() => true));
  assert.ok(res.n > 0);
  assert.strictEqual(treeToCodeRel(root).trim(), treeToCodeRel(branchOf(B)).trim());
});
ok('删枝勾上 → 那根枝连同下枝一起消失', () => {
  const B = CODE_A.replace(/    枝 浙派[\s\S]*$/, '');
  const r = diffCodes(CODE_A, B);
  const root = branchOf(CODE_A);
  落地改动(root, r.changes, r.changes.map(() => true));
  const hb = root.children.find(c => c.name === '绘画') || root;      // 浙派挂在「绘画」下
  assert.ok(!(hb.children || []).some(c => c.name === '浙派'), '浙派那根枝应当没了');
  assert.strictEqual((hb.children || []).length, 0, '「绘画」下不该再剩别的枝');
});
ok('父枝也被删时，子枝那几条自动跳过，不算失败', () => {
  const B = '枝 明\n  叶 概述\n    明代画坛分前后两期。';
  const r = diffCodes(CODE_A, B);
  const tree = branchOf(CODE_A);
  const res = 落地改动(tree, r.changes, r.changes.map(() => true));
  assert.ok(res && res.n > 0);
  assert.ok(res.dropped >= 0);
});

console.log('\n四、编辑语言（小修用的逃生口）');

function ctxOf(code) { return branchOf(code); }
ok('属性：加、改、删（值写减号）', () => {
  const root = { name: '根', leaves: [{ name: '概述', desc: 'x' }], children: [] };
  const r = applyEdit(root, '进入 类型: 框架\n进入 类型: 工具\n进入 别名-');
  assert.ok(r.ok, r.error);
  assert.strictEqual(r.root.props['类型'], '工具');
  assert.strictEqual(r.root.props['别名'], undefined);
});
ok('进入路径 + 改叶正文（只给正文＝整片替换）', () => {
  const root = ctxOf(CODE_A);
  const r = applyEdit(root, '进入 明/绘画\n叶 概述\n  改过的正文');
  assert.ok(r.ok, r.error);
  const hb = r.root.children.find(c => c.name === '绘画');                    // applyEdit 改的是副本
  assert.ok(hb, '「绘画」还在');
  assert.strictEqual(leafOf(hb, '概述').desc, '改过的正文');
});
ok('叶原本不存在 → 新建一片', () => {
  const root = ctxOf(CODE_A);
  const r = applyEdit(root, '进入 明\n叶 环\n  时代环节');
  assert.ok(r.ok, r.error);
  assert.ok(leafOf(r.root, '环'), '「环」该长在当前枝上');
});
ok('路径写错 → 报错，且原树一个字节都不动', () => {
  const root = ctxOf(CODE_A);
  const keep = clone(root);
  const r = applyEdit(root, '进入 明/不存在\n叶 概述\n  x');
  assert.strictEqual(r.ok, false);
  assert.ok(/找不到路径/.test(r.error), r.error);
  assert.deepStrictEqual(root, keep);
});
ok('没写任何改动 → 明确说「没有可做的改动」，不静默', () => {
  const r = applyEdit(ctxOf(CODE_A), '进入 明');
  assert.strictEqual(r.ok, false);
  assert.ok(/没有可做的改动/.test(r.error), r.error);
});
ok('「株」＝整根覆盖：块里没写的叶会被删掉（普通「枝」不会）', () => {
  const root = { name: '根', leaves: [], children: [{ name: '明', leaves: [], children: [
    { name: '绘画', leaves: [{ name: '概述', desc: '旧' }, { name: '多余', desc: '去掉我' }], children: [] }
  ] }] };
  const code = '株 明/绘画\n  枝 绘画\n    叶 概述\n      新的';
  const r = applyEdit(root, code);
  assert.ok(r.ok, r.error);
  const hb = r.root.children[0].children[0];       // applyEdit 不改入参，换的是副本
  assert.deepStrictEqual(hb.leaves.map(l => l.name), ['概述']);
  assert.strictEqual(hb.leaves[0].desc, '新的');
});
ok('编辑语言解析：减号＝删属性，冒号两种写法都认', () => {
  const t = editParse('进入 朝代：明\n进入 别名-');
  assert.strictEqual(t.length, 2);
  assert.strictEqual(t[0].prop.k, '朝代');
  assert.strictEqual(t[0].prop.v, '明');
  assert.strictEqual(t[1].prop.remove, true);
  assert.strictEqual(t[1].prop.k, '别名');
});

console.log(`\n结果：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
