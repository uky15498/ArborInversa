// 示例树自测 —— 默认拿仓库自带的《示例树.txt》当夹具，**不依赖任何已有内容**
//
// 为什么有这一套：
//   codec.test.js / search.test.js 是拿「真实内容数据」当夹具的，只在本机有内容时才跑得动；
//   这一套的夹具是**仓库自带的一棵小树**，所以谁 clone 下来都能跑。
//
// ★ 它不依赖任何内容，示例树删了也能跑：
//   一、通用断言 —— 对**任何一棵树**都成立（连两行的空树都能跑）：解析、往返、叶非空、
//       属性值类型、[[链接]]、![[图片]]、搜索单位数、每根枝都能用「枝:名字」搜到、条件行映射
//   二、示例树专属断言 —— 只在夹具**就是仓库那棵《示例树.txt》**、且它的枝名没被人改过时才跑：
//       「这棵示例树覆盖到了哪些能力」＋ 各搜索语法的期望值。夹具换成别的树、或示例树被删/被改名，
//       这一段自动跳过（只跑通用段），不会让别人自检不了。
//
// 写法备注（要加断言就照这六条来）
//   1. **真实实现只抽取、不重写**：index.html 里用 `// ==== 搜索 BEGIN/END ====`、
//      `// ==== 树 ⇄ 文本代码 BEGIN/END ====`（编解码另有 tools/codec-from-html.js）标出区块；
//      这里按标记切出来、用 `new Function` 求值 —— 测的就是页面里跑的那份代码，不是抄一份。
//   2. **夹具先行**：树文本 → codeToTree() → 一棵数据树，把它直接当搜索的 DATA。
//      注意别手搓 {name,leaves,children}，那样会把 props 丢掉。
//   3. **断言用 Node 内置 assert**，每条包在 ok(标题, fn) 里：失败不中断，最后汇总通过/失败数。
//   4. **搜索断言写「命中集合」而不是「命中数」**：把期望的名字数组与结果对拍，看名字就懂意图。
//   5. **通用段 vs 专属段**：跟具体内容无关的（纯函数映射、结构性规则）放通用段；
//      依赖那棵示例树具体枝名的放专属段，并用「锚点枝名在不在」判断该不该跑。
//   6. **退出码**：全过 0，有失败 1 —— 可以直接挂进提交钩子或 CI。
//
// 用法：
//   node tools/tree.test.js                  # 仓库自带示例树（两段都跑）
//   node tools/tree.test.js --file <文件>     # 换一棵树当夹具（只跑通用段）
//   FIXTURE=<文件> node tools/tree.test.js    # 同上（环境变量写法）
const fs = require('fs'), path = require('path'), assert = require('assert');
const { loadPure, loadCodec } = require('./codec-from-html');

const REPO = path.join(__dirname, '..');
const DEMO = path.join(REPO, '示例树.txt');       // 仓库自带的示例树
const REPO_DATA = path.join(REPO, 'data.json');   // 仓库那份数据（正常就是示例树的 JSON 形式）

// ── 0) 夹具：--file / FIXTURE → 示例树 → 仓库 data.json（都没有就跳过，不算失败）──
const fi = process.argv.indexOf('--file');
let FIXTURE = fi >= 0 && process.argv[fi + 1] ? process.argv[fi + 1] : (process.env.FIXTURE || DEMO);
let fellBack = false;
if (!fs.existsSync(FIXTURE) && fs.existsSync(REPO_DATA)) {
  console.log(`· 没找到 ${path.basename(FIXTURE)}，改用仓库 data.json 当夹具（只跑通用段）`);
  FIXTURE = REPO_DATA; fellBack = true;
}
if (!fs.existsSync(FIXTURE)) {
  console.log(`· 没有可用的夹具（既没有 ${DEMO} 也没有 ${REPO_DATA}）—— 跳过，不算失败`);
  console.log('  想自检自己的树：node tools/tree.test.js --file <你的 data.json 或 .txt>');
  process.exit(0);
}
const IS_DEMO_FILE = !fellBack && path.resolve(FIXTURE) === path.resolve(DEMO);

// ── 1) 从 index.html 抽真实实现 ─────────────────────────────
const src = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
function slice(a, b, what) {
  const i = src.indexOf(a), j = src.indexOf(b, i + a.length);
  assert(i >= 0 && j > i, 'index.html 里找不到：' + what);
  return src.slice(i, j);
}
const engine = new Function('DATA', loadPure() +
  '\nreturn {sTokens,searchUnits,runSearch,runQuery,runRows,rowsToTokens,condSyntax,findPathsByName,inPath,isBranchConst,esc,' +
  'IMG_TABLE,IMG_LEN,IMG_EXTS,isImgValue,imgValueFromHash,isMobileUA,isMobileUI,uiOverrideOf};');

const { treeToCode, codeToTree } = loadCodec();

// ── 2) 读夹具 ──────────────────────────────────────────────
const text = fs.readFileSync(FIXTURE, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const isJSON = FIXTURE.endsWith('.json');
const parsed = isJSON ? { title: null, children: [JSON.parse(text)] } : codeToTree(text);
const ROOT = parsed.children[0];            // 根枝（含 props，别手搓丢属性）
const S = engine(ROOT);                     // 搜索用的 DATA ＝ 这棵树

// 图片从哪儿找：按顺序试这几个目录，任一命中即可 ——
//   ① --media <目录> 指定的（若有）
//   ② 与夹具同目录的 media/（自己的数据在应用目录、示例树在仓库根，都成立）
//   ③ 仓库的 media/（夹具被拷到别处时也能找到）
//   ④ 应用目录的 media/（拿自己的树当夹具时常用）
const mi = process.argv.indexOf('--media');
const MEDIA_DIRS = (mi >= 0 && process.argv[mi + 1])
  ? [process.argv[mi + 1]]
  : [path.join(path.dirname(path.resolve(FIXTURE)), 'media'), path.join(REPO, 'media'),
     '/mnt/c/ArborInversa/media'].filter(d => fs.existsSync(d));
// 与应用同一套找法：
//   · 写了文件名（带扩展名）→ 按文件名找
//   · 只写了「值」（平水韵五言，不带扩展名）→ 找「去掉扩展名后等于该值」的文件
//     （浏览器里没法列目录，应用是依次试候选扩展名实现的，效果等价）
const hasImage = f => MEDIA_DIRS.some(d => {
  if (fs.existsSync(path.join(d, f))) return true;
  if (/\.[a-z0-9]+$/i.test(f)) return false;
  try { return fs.readdirSync(d).some(x => path.parse(x).name === f); } catch (e) { return false; }
});

let pass = 0, fail = 0;
function ok(title, fn) {
  try { fn(); console.log('  ✓ ' + title); pass++; }
  catch (e) { console.log('  ✗ ' + title + '\n      ' + (e && e.message)); fail++; }
}
const NAMES = hits => hits.map(h => h.u.leaf ? h.u.name + '›' + h.u.leafName : h.u.name);
const isBranchHit = h => !h.u.leaf;
function eqSet(actual, expected, what) {
  assert.deepStrictEqual([...actual].sort(), [...expected].sort(), what || '集合不一致');
}
function walk(n, fn, depth = 0) { fn(n, depth); (n.children || []).forEach(c => walk(c, fn, depth + 1)); }
function count() {
  let br = 0, lv = 0, pr = 0;
  const names = new Set();      // 所有名字（枝名 ＋ 叶名）：查 [[链接]]、查锚点用
  const branches = new Set();   // 只含枝名：查「枝:名字」用
  walk(ROOT, n => {
    br++; pr += Object.keys(n.props || {}).length; names.add(n.name); branches.add(n.name);
    (n.leaves || []).forEach(l => { lv++; names.add(l.name); });
  });
  return { br, lv, pr, names, branches };
}
// 规范化：编解码的既定行为是裁掉叶正文末尾的空行与行尾空格，比对前先对齐
function canon(n) {
  return {
    name: n.name,
    props: n.props || undefined,
    leaves: (n.leaves || []).map(l => ({ name: l.name, desc: String(l.desc == null ? '' : l.desc).replace(/[ \t]+$/gm, '').replace(/\n+$/, '') })),
    children: (n.children || []).map(canon),
  };
}
const C = count();

console.log(`夹具：${path.relative(REPO, FIXTURE)}（${C.br} 枝／${C.lv} 叶／${C.pr} 属性）`);
console.log(`     搜索引擎与编解码抽取自 index.html\n`);

// ── 一、通用断言（任何一棵树都该满足）──────────────────────
console.log('一、通用（任何一棵树都该满足）');
ok('能被解析，根枝有名字', () => {
  assert.ok(ROOT && typeof ROOT.name === 'string' && ROOT.name.trim(), '根枝名不能为空');
});
ok('每片叶都有正文', () => {
  const empty = [];
  walk(ROOT, n => (n.leaves || []).forEach(l => { if (!String(l.desc || '').trim()) empty.push(n.name + '›' + l.name); }));
  assert.deepStrictEqual(empty, []);
});
ok('属性值类型合法：单值写文本、多值写数组且至少两项', () => {
  const bad = [];
  walk(ROOT, n => Object.entries(n.props || {}).forEach(([k, v]) => {
    const good = typeof v === 'string' ? !!v.trim()
               : (Array.isArray(v) && v.length > 1 && v.every(x => typeof x === 'string' && x.trim()));
    if (!good) bad.push(n.name + '.' + k);
  }));
  assert.deepStrictEqual(bad, []);
});
ok('所有 [[跳转]] 都指向存在的枝', () => {
  const bad = [];
  walk(ROOT, n => (n.leaves || []).forEach(l => {
    const t = String(l.desc || '').replace(/!\[\[[^\]]+\]\]/g, '');
    for (const m of t.matchAll(/\[\[([^\]]+)\]\]/g)) if (!C.names.has(m[1])) bad.push(m[1]);
  }));
  assert.deepStrictEqual([...new Set(bad)], []);
});
// 示例树里**故意**放了一张不存在的图，用来演示「缺图时画占位框」。
// 它必须在下面这份名单里，否则这条断言就该失败 —— 免得哪天真的漏图却被当成「故意的」。
const DELIBERATELY_MISSING = new Set(['東冬江支微']);
ok('所有 ![[图片]] 在 media/ 里都存在（除示例里故意缺的那张）', () => {
  const missing = [];
  walk(ROOT, n => (n.leaves || []).forEach(l => {
    for (const m of String(l.desc || '').matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      const ref = m[1].trim();
      if (!hasImage(ref) && !DELIBERATELY_MISSING.has(ref)) missing.push(ref);
    }
  }));
  assert.deepStrictEqual([...new Set(missing)], [],
    '这些图在以下目录都没找到：' + MEDIA_DIRS.map(d => path.relative(REPO, d) || '.').join('、'));
});
ok('示例树里那张「故意缺的图」确实不在库里（占位框演示才有意义）', () => {
  for (const ref of DELIBERATELY_MISSING) {
    assert.ok(!hasImage(ref), ref + ' 竟然在库里了 —— 那占位框就演示不出来了，请换一个值');
  }
});
ok('treeToCode → codeToTree 除既定的规范化外不改变内容', () => {
  const back = codeToTree(treeToCode(ROOT));
  assert.strictEqual(back.children.length, 1);
  assert.deepStrictEqual(canon(back.children[0]), canon(ROOT),
    '除叶正文末尾空行被裁掉外，结构与内容都应一致');
});
ok('二次往返是固定点（再来一轮不再变化）', () => {
  const once = treeToCode(ROOT);
  assert.strictEqual(treeToCode(codeToTree(once).children[0]), once);
});
ok('导出的代码以「枝 名称」开头，子枝缩进一层', () => {
  const lines = treeToCode(ROOT).split('\n');
  assert.strictEqual(lines[0], '枝 ' + ROOT.name);
  if (ROOT.children.length) assert.ok(lines.some(l => l.startsWith('  枝 ')), '子枝应缩进一层');
});
ok('搜索单位数 ＝ 枝数 ＋ 叶数', () => {
  const u = S.searchUnits();
  assert.strictEqual(u.length, C.br + C.lv);
  assert.strictEqual(u.filter(x => x.leaf).length, C.lv);
});
ok('每根枝都能用「枝:名字」搜到自己', () => {
  const miss = [];
  for (const n of C.branches) {
    if (!S.runSearch('枝:' + n).filter(isBranchHit).map(h => h.u.name).includes(n)) miss.push(n);
  }
  assert.deepStrictEqual(miss, [], '这些枝搜不到自己');
});
ok('rowsToTokens：各维度映射成对应语法，空值不参与', () => {
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'prop', key: '标签', value: 'xxx' }]), [{ field: '标签', text: 'xxx' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'scope', value: 'xxx' }]), [{ field: '下', text: 'xxx' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'branch', value: 'xxx' }]), [{ field: '枝', text: 'xxx' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'leaf', value: 'xxx' }]), [{ field: '叶', text: 'xxx' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'text', value: 'xxx' }]), [{ field: '文', text: 'xxx' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'depth', value: '2' }]), [{ field: '深', text: '2' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'has', value: '链' }]), [{ field: '含', text: '链' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'neg', value: 'xxx' }]), [{ neg: true, text: 'xxx' }]);
  assert.deepStrictEqual(S.rowsToTokens([{ kind: 'branch', value: '   ' }]), []);
});
ok('esc：转义后不留裸引号（属性名/值里的 " 不会把 HTML 属性截断）', () => {
  const s = S.esc('别名" onfocus="alert(1)');
  assert.strictEqual(s.indexOf('"'), -1, 'esc 之后不该还有裸引号：' + s);
  assert.ok(s.indexOf('&quot;') >= 0, '引号该被转成 &quot;');
  assert.strictEqual(S.esc('<b>&</b>'), '&lt;b&gt;&amp;&lt;/b&gt;');
  assert.strictEqual(S.esc(null), '', 'null 不该变成 "null"');
});
ok('图片值：平水韵 106 韵目字表完整、无重复、分组 15/15/29/30/17', () => {
  const g = [...S.IMG_TABLE];
  assert.strictEqual(g.length, 106, '平水韵共 106 韵');
  assert.strictEqual(new Set(g).size, 106, '字表里不该有重复字');
  assert.deepStrictEqual(
    [g.slice(0, 15).length, g.slice(15, 30).length, g.slice(30, 59).length, g.slice(59, 89).length, g.slice(89).length],
    [15, 15, 29, 30, 17], '上平/下平/上声/去声/入声');
});
ok('图片值：同一张图必得同值、不同内容必不同值、形如五言', () => {
  const crypto = require('crypto');
  const h = s => crypto.createHash('sha256').update(s).digest('hex');
  const a = S.imgValueFromHash(h('some-image-bytes'));
  assert.strictEqual(a, S.imgValueFromHash(h('some-image-bytes')), '值必须由内容唯一决定');
  assert.ok(S.isImgValue(a), '认得出这是值：' + a);
  assert.strictEqual([...a].length, S.IMG_LEN);
  assert.ok(!S.isImgValue('示例-汝窑天青釉.svg'), '带文件名的老写法不该被当成值');
  assert.ok(!S.isImgValue('东冬江支微'), '简体字不在表里，不该误认');
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(S.imgValueFromHash(h('img' + i)));
  assert.strictEqual(seen.size, 2000, '2000 张图不该出现撞值');
});
ok('condSyntax 与 rowsToTokens 同一张表：条件行写出来的语法能搜回同样的东西', () => {
  const cases = [
    { kind: 'scope', value: 'xxx' }, { kind: 'branch', value: 'xxx' }, { kind: 'leaf', value: 'xxx' },
    { kind: 'text', value: 'xxx' }, { kind: 'depth', value: '2' }, { kind: 'has', value: '链' },
    { kind: 'neg', value: 'xxx' }, { kind: 'prop', key: '标签', value: 'xxx' },
  ];
  for (const c of cases) {
    const syn = S.condSyntax([c]);
    assert.ok(syn, c.kind + ' 该能写出等价语法');
    // 两边形状略有差别（语法解析出来会多带一个 neg:false），比语义即可
    const norm = t => ({ field: t.field, text: t.text, neg: t.neg === true });
    assert.deepStrictEqual(S.sTokens(syn).map(norm), S.rowsToTokens([c]).map(norm),
      c.kind + '：语法与条件行对不上（' + syn + '）');
  }
  assert.strictEqual(S.condSyntax([{ kind: 'branch', value: '  ' }]), '', '空值条件不写语法');
  assert.strictEqual(S.condSyntax([{ kind: 'prop', key: '', value: 'x' }]), '', '属性没填名字不写语法');
});

// 手机版判定：认得准才不会「手机上打开却是三栏挤成一条缝」，也不会「电脑上打开成了手机版」。
// 判据只有一处落进 HTML —— <html> 上的 is-mobile 类；这里验的就是决定它的那个纯函数。
ok('手机版判定：UA 认得出手机，不误伤电脑', () => {
  const MOBILE = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0 Mobile Safari/537.36 Edge/15.15063',
    'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1',
  ];
  const DESKTOP = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
    '',   // 拿不到 UA（隐私模式等）：只能靠宽度那条兜底
  ];
  MOBILE.forEach(ua => assert.strictEqual(S.isMobileUA(ua), true, '该认成手机：' + ua.slice(0, 60)));
  DESKTOP.forEach(ua => assert.strictEqual(S.isMobileUA(ua), false, '不该认成手机：' + ua.slice(0, 60)));
});
ok('手机版判定：地址栏开关说了算，其次看 UA，最后看宽度', () => {
  const DESK = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36';
  const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1';
  const D = (ua, width, override, mobileData) => S.isMobileUI({ ua, width, override, mobileData });
  assert.strictEqual(D(DESK, 1280, 'mobile'), true, '?ui=mobile 在电脑上也要给手机版');
  assert.strictEqual(D(PHONE, 390, 'desktop'), false, '?ui=desktop 在手机上也要给三栏');
  assert.strictEqual(D(DESK, 1280), false, '宽屏电脑＝三栏');
  assert.strictEqual(D(DESK, 700), true, '窄窗口的电脑也塞不下三栏');
  assert.strictEqual(D(PHONE, 818), true, '手机横屏比 768 还宽，靠 UA 认出来');
  assert.strictEqual(D('', 390), true, '认不出 UA 时靠宽度兜底');
  assert.strictEqual(D(DESK, 1280, '', true), true, 'userAgentData.mobile 说了算');
  assert.strictEqual(D(DESK, 1280, '', false), false, 'userAgentData.mobile=false 别当成手机');
});
ok('手机版判定：?ui= 只认这两个值', () => {
  assert.strictEqual(S.uiOverrideOf('?ui=mobile'), 'mobile');
  assert.strictEqual(S.uiOverrideOf('?a=1&ui=desktop&b=2'), 'desktop');
  assert.strictEqual(S.uiOverrideOf('?ui=MOBILE'), 'mobile', '大小写不该影响');
  assert.strictEqual(S.uiOverrideOf('?ui=tablet'), '', '别的值一律当没写');
  assert.strictEqual(S.uiOverrideOf(''), '');
  assert.strictEqual(S.uiOverrideOf('?xui=mobile'), '', '不是 ui= 这个参数就不算');
});

// ── 二、示例树专属断言 ─────────────────────────────────────
// 只在这棵示例树「还是仓库那棵」时跑：夹具是别的树 → 跳过；示例树被人删/改名 → 也跳过。
const ANCHORS = ['结构', '能力', '用法', '插图', '跳转', '再深一层'];
const anchorsOK = ANCHORS.every(n => C.names.has(n));
if (!IS_DEMO_FILE || !anchorsOK) {
  console.log('\n二、示例树专属（跳过）');
  console.log(IS_DEMO_FILE
    ? '   · 这棵示例树的枝名已变动（锚点：' + ANCHORS.join('、') + '），按现状只跑通用段'
    : '   · 夹具不是仓库自带的《示例树.txt》，只跑通用段');
} else {
  console.log('\n二、示例树专属（它的规格 ＋ 各搜索语法的期望值）');
  ok('首行是标题行「树 示例树」，根枝同名', () => {
    assert.strictEqual(parsed.title, '示例树');
    assert.strictEqual(ROOT.name, '示例树');
  });
  ok('演示覆盖到位：≥2 根下枝、每枝有叶、有跳转/插图/多值属性、最深深到第 2 层', () => {
    assert.ok(ROOT.children.length >= 2, '至少要有两根下枝');
    const bare = [];
    walk(ROOT, n => { if (n !== ROOT && !(n.leaves || []).length) bare.push(n.name); });
    assert.deepStrictEqual(bare, [], '这些枝没有叶，撑不起演示');
    let lk = 0, im = 0, multi = 0, deep = 0;
    walk(ROOT, (n, d) => {
      deep = Math.max(deep, d);
      for (const k of Object.keys(n.props || {})) if (Array.isArray(n.props[k])) multi++;
      for (const l of (n.leaves || [])) {
        const t = String(l.desc || '');
        im += (t.match(/!\[\[[^\]]+\]\]/g) || []).length;
        lk += (t.replace(/!\[\[[^\]]+\]\]/g, '').match(/\[\[[^\]]+\]\]/g) || []).length;
      }
    });
    assert.ok(lk >= 1, '至少要有一处跳转演示');
    assert.ok(im >= 1, '至少要有一处插图演示');
    assert.ok(multi >= 1, '至少要有一个多值属性');
    assert.ok(deep >= 2, '至少要深一层以上');
  });
  ok('规模在合理区间（示例树要小而全：枝 3–40、叶 3–80、属性 0–100）', () => {
    assert.ok(C.br >= 3 && C.br <= 40, '枝数 ' + C.br + ' 超出区间');
    assert.ok(C.lv >= 3 && C.lv <= 80, '叶数 ' + C.lv + ' 超出区间');
    assert.ok(C.pr <= 100, '属性数 ' + C.pr + ' 超出区间');
  });
  ok('文件用「树 …」标题行写法，与导出的「枝 …」写法解析结果一致', () => {
    assert.ok(text.startsWith('树 示例树'), '示例树文件首行是标题行');
    assert.deepStrictEqual(codeToTree(text).children[0], codeToTree(treeToCode(ROOT)).children[0]);
  });
  ok('枝: 只限定枝名', () => {
    const h = S.runSearch('枝:结构');
    eqSet(NAMES(h), ['结构']);
    h.forEach(x => assert.ok(isBranchHit(x), '枝: 只应给出枝级结果'));
  });
  ok('叶: 只限定叶名', () => eqSet(NAMES(S.runSearch('叶:插图')), ['能力›插图']));
  ok('文: 只限定叶正文', () => {
    const h = S.runSearch('文:题注');
    eqSet(NAMES(h), ['能力›插图']);
    h.forEach(x => assert.strictEqual(x.where, '文'));
  });
  ok('属性筛选：多值属性里的某一个值也能命中', () => {
    eqSet(NAMES(S.runSearch('标签:跳转')), ['能力']);
    eqSet(NAMES(S.runSearch('标签:框架演示')), ['示例树']);
  });
  ok('有: 找带某属性的枝（根枝也算）', () => {
    eqSet(NAMES(S.runSearch('有:标签')), ['示例树', '结构', '能力']);
    eqSet(NAMES(S.runSearch('有:类型')), ['示例树', '结构', '能力', '再深一层']);
  });
  ok('深: 限定层级（根 ＝ 0）', () => {
    eqSet(NAMES(S.runSearch('深:1')), ['结构', '能力', '用法']);
    eqSet(NAMES(S.runSearch('深:2')), ['再深一层']);
  });
  ok('含: 图／链／下枝', () => {
    // 「含:图」的期望值从夹具自己算：凡是正文里有 ![[…]] 的叶都该命中 ——
    // 免得每次给示例树加张图都要回来改这条断言（加图是常事）
    const withImg = [];
    walk(ROOT, n => (n.leaves || []).forEach(l => {
      if (/!\[\[/.test(String(l.desc || ''))) withImg.push(n.name + '›' + (l.name || '叶'));
    }));
    eqSet(NAMES(S.runSearch('含:图')), withImg);
    eqSet(NAMES(S.runSearch('含:链')), ['能力›跳转']);
    eqSet(NAMES(S.runSearch('含:下枝')), ['示例树', '能力']);
  });
  ok('下: 限定范围（只在这枝及其下级里找）', () => eqSet(NAMES(S.runSearch('下:结构')), ['结构']));
  ok('多词是 AND', () => {
    eqSet(NAMES(S.runSearch('结构 属性')), ['结构', '示例树›概述']);
    assert.deepStrictEqual(S.runSearch('结构 这个词不存在'), []);
  });
  ok('"整段短语" 精确匹配', () => eqSet(NAMES(S.runSearch('"一根枝可以挂多片叶"')), ['结构›叶']));
  ok('查不到的词 / 只有排除词的查询都返回空（既定行为）', () => {
    assert.deepStrictEqual(S.runSearch('枝:不存在'), []);
    assert.deepStrictEqual(S.runSearch('-插图'), []);
  });
  ok('runRows：「并且」按交集算', () => {
    eqSet(NAMES(S.runRows([{ kind: 'scope', value: '能力' }, { kind: 'prop', key: '标签', value: '深层' }], { combine: 'and' })), ['能力']);
    eqSet(NAMES(S.runRows([{ kind: 'has', value: '链' }, { kind: 'scope', value: '能力' }], { combine: 'and' })), ['能力›跳转']);
    assert.deepStrictEqual(S.runRows([{ kind: 'branch', value: '结构' }, { kind: 'branch', value: '用法' }], { combine: 'and' }), []);
  });
  ok('runRows：「或者」按并集算', () => {
    eqSet(NAMES(S.runRows([{ kind: 'branch', value: '结构' }, { kind: 'branch', value: '用法' }], { combine: 'or' })), ['结构', '用法']);
  });
  ok('条件行与「等价语法」结果一致（点一下转进关键词框的保证）', () => {
    const rows = [{ kind: 'scope', value: '能力' }, { kind: 'prop', key: '标签', value: '深层' }];
    eqSet(NAMES(S.runQuery(S.rowsToTokens(rows), { combine: 'and' })), NAMES(S.runRows(rows, { combine: 'and' })));
  });
}

// ── 汇总 ──────────────────────────────────────────────────
console.log(`\n结果：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
