// 云端登录自测 —— **不联网**：把 index.html 里的「云端」整段切出来求值，
// fetch 换成一台按剧本回话的假服务器，专测「分区」这条最容易骗到人的路径。
//
// 为什么有这一套（真实踩过的坑，2026-09-22）：
//   用户登录时**密码是对的**，却被提示「口令不对」，反复重试。真因有两条：
//     一、面板默认高亮的是「第一个空区」（那是给注册用的），把老用户的手指往坑里引 ——
//         他一点「通」、一登录，服务端回 404「通区没这个账号」；
//     二、客户端把 404 和 401 混为一谈，一律喊「口令不对」，**把分区选错说成密码错**。
//   这两条都不报错、不崩溃，只是「话不对」，所以特别容易悄悄回来 —— 这里钉死它们。
//
// ★ 真实实现只抽取、不重写（house style，见 tree.test.js 的写法备注）：
//   从 `// ==== 云端（账号 ＋ 分区）` 切到「初始化」标记之前那一行 `})();`。
//   断言用 Node 内置 assert，每条包在 ok() 里，最后汇总。退出码：全过 0，有失败 1。
//
// 用法：node tools/cloud.test.js
//       ARBOR_HTML=<别的前端> node tools/cloud.test.js   # 拿老版本验一验这套测试抓不抓得住
const fs = require('fs'), path = require('path'), assert = require('assert');

const REPO = path.join(__dirname, '..');
const HTML = process.env.ARBOR_HTML || path.join(REPO, 'index.html');   // 可用 ARBOR_HTML 指别的前端（验证测试本身管不管用）

// ── 1) 从 index.html 切出「云端」整段真实代码 ──────────────────────────────
function loadCloud() {
  const lines = fs.readFileSync(HTML, 'utf8').split('\n');
  const begin = lines.findIndex(l => l.includes('==== 云端（账号 ＋ 分区）'));
  assert(begin >= 0, '在 index.html 里找不到「云端」段标记');
  const initAt = lines.findIndex((l, i) => i > begin && l.includes('---- 初始化 ----'));
  assert(initAt > begin, '在 index.html 里找不到「初始化」标记（云端段的收尾锚点）');
  let end = -1;
  for (let i = initAt - 1; i > begin; i--) if (lines[i].trim() === '})();') { end = i; break; }
  assert(end > begin, '在「云端」段与「初始化」之间找不到收尾的 })();');
  return lines.slice(begin, end + 1).join('\n');
}

// ★ 冲突弹窗（#cloudConflict）在真机上要等用户点按钮；测试里没人点，
//   所以给它装一个「自动应答」：用例先设好 冲突答复，弹窗一挂上 onclick 就替用户点。
let 冲突答复 = 'theirs';
// ★ 沙箱把 setTimeout 换成了空函数（防抖不该真跑），所以等待要用**真的**定时器
const 等一下 = (ms = 0) => new Promise(r => require('timers').setTimeout(r, ms));
// 弹窗上挂着的那两个 handler —— 记下来，用例可以事后替用户点
const 待点 = { mine: null, theirs: null };
const 点冲突 = (哪个) => { const h = 待点[哪个]; assert(h, '冲突弹窗上还没有「' + 哪个 + '」的按钮'); h(); };

// ── 2) 假的浏览器环境（够云端那段用就行）────────────────────────────────
function 造环境() {
  const BTN = [];
  const els = {};
  const El = id => ({
    id, value: '', textContent: '', innerHTML: '', title: '', style: {}, dataset: {}, _h: {},
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    addEventListener(t, f) { (this._h[t] = this._h[t] || []).push(f); },
    fire(t) { (this._h[t] || []).forEach(f => f()); },
    querySelectorAll() { return BTN; },
  });
  // 冲突弹窗那两个按钮：onclick 一被挂上，就按 冲突答复 替用户点（★ 必须放在 El 之后）
  function 造冲突元素(id) {
    const e = El(id); let h = null;
    Object.defineProperty(e, 'onclick', {
      get() { return h; },
      set(f) {
        h = f;
        待点[id === 'ccMine' ? 'mine' : 'theirs'] = f;
        const 该我 = (id === 'ccMine' && 冲突答复 === 'mine') || (id === 'ccTheirs' && 冲突答复 === 'theirs');
        if (该我) queueMicrotask(() => { if (h) h(); });
      },
    });
    return e;
  }
  const document = {
    getElementById(id) {
      if (id === 'ccMine' || id === 'ccTheirs') return els[id] = els[id] || 造冲突元素(id);
      return els[id] = els[id] || El(id);
    },
    querySelector(sel) {
      const m = sel.match(/#cloudParts button(?:\.(cand|on))?/);
      if (!m) return null;
      const cls = m[1];
      return BTN.find(b => !cls || b.classList.contains(cls)) || null;
    },
    querySelectorAll(sel) { return sel.includes('#cloudParts button') ? BTN : []; },
    createElement() { return El('x'); },
  };
  const localStorage = {
    _d: {},
    getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
  };
  // innerHTML 赋值 → 真的把按钮造出来（页面里由浏览器干这件事）
  const host = document.getElementById('cloudParts');
  Object.defineProperty(host, 'innerHTML', {
    set(v) {
      BTN.length = 0;
      for (const m of v.matchAll(/data-p="(.)" class="([^"]*)"/g)) {
        const b = El('btn'); b.dataset.p = m[1];
        m[2].split(/\s+/).filter(Boolean).forEach(c => b.classList.add(c));
        BTN.push(b);
      }
    },
    get() { return ''; },
  });
  return { BTN, els, document, localStorage, host };
}

// ── 3) 一台按剧本回话的假服务器（照抄 tools/cloud-server.js 的语义）────────
function 造假服务器() {
  const 剧本 = { 名字: 'Urgestalt', 占用: ['流'], 口令: '123223', 版本: 'v1', 请求: [] };
  const 空着 = () => ['通', '江', '止', '遇', '蟹', '臻', '山', '效', '果', '假', '宕', '梗', '曾', '深', '咸']
    .filter(p => !剧本.占用.includes(p));

  const fetch = async (url, opt = {}) => {
    const 方法 = opt.method || 'GET';
    const body = opt.body ? JSON.parse(opt.body) : {};
    const 全路径 = url.replace(/^https?:\/\/[^/]+/, '');
    // ★ 真地址是 CLOUD_DEFAULT（…/arbor），路径前缀不属于路由 —— 从 /api/ 处切
    const i = 全路径.indexOf('/api/');
    const p = i >= 0 ? 全路径.slice(i) : 全路径;
    剧本.请求.push(方法 + ' ' + p + (body.part ? ' [part=' + body.part + ']' : ''));
    const 回 = (status, obj) => ({ ok: status < 300, status, async json() { return obj; } });

    if (p.startsWith('/api/parts')) {
      // ★ 占用跟名字走：别人的名字不该看到「Urgestalt 的区被占」
      const 问的 = decodeURIComponent((p.split('name=')[1] || ''));
      const 占 = 问的 === 剧本.名字 ? 剧本.占用 : [];
      return 回(200, { ok: true, 占用: 占, 空着: 空着() });
    }
    if (p === '/api/login') {
      if (!剧本.占用.length) return 回(404, { ok: false, error: '没有叫「' + body.name + '」的账号 —— 要新建吗？' });
      if (!body.part && 剧本.占用.length > 1) {
        return 回(409, { ok: false, error: '有多个区都叫「' + body.name + '」，选一个进来', 候选: 剧本.占用 });
      }
      const 区 = body.part || 剧本.占用[0];
      if (!剧本.占用.includes(区)) {                    // ★ 分区错了：404 ＋ 候选（不是 401！）
        return 回(404, { ok: false, error: '「' + 区 + '」区没有叫「' + body.name + '」的账号', 候选: 剧本.占用 });
      }
      if (String(body.pass) !== 剧本.口令) return 回(401, { ok: false, error: '口令不对' });
      return 回(200, { ok: true, name: body.name, part: 区, token: 'TOKEN-' + 区 });
    }
    if (p === '/api/tree' && 方法 === 'GET') {
      return 回(200, { ok: true, tree: { name: '逆生树', leaves: [{ name: '概述', desc: '逆生树…' }], children: [] }, 版本: 剧本.版本, 改于: '2026-09-22T00:00:00Z' });
    }
    if (p === '/api/tree' && 方法 === 'PUT') {
      return 回(200, { ok: true, 版本: 剧本.版本, 改于: '2026-09-22T00:00:00Z' });
    }
    if (p === '/api/me') {
      return 回(200, { ok: true, name: 'Urgestalt', part: 剧本.占用[0], 建号: '2026-09-16T00:00:00Z', 改于: '2026-09-22T00:00:00Z', 版本: 剧本.版本, 字节: 67660 });
    }
    return 回(404, { ok: false, error: '没有这个接口：' + p });
  };
  return { 剧本, fetch };
}

// ── 4) 装好环境、求值真实云端代码 ────────────────────────────────────────
function 起云() {
  const env = 造环境(), srv = 造假服务器();
  const TOASTS = [];
  const g = globalThis;
  const 存 = {};
  for (const k of ['fetch', 'document', 'localStorage', 'location', 'confirm', 'prompt',
    'setTimeout', 'clearTimeout', 'esc', 'toast', 'render', 'navReset', 'leavesOf', 'Store', 'DATA',
    'curPath', 'curLeaf']) 存[k] = g[k];

  g.fetch = srv.fetch;
  g.document = env.document;
  g.localStorage = env.localStorage;
  g.location = { protocol: 'file:' };
  g.confirm = () => true;
  g.prompt = () => null;
  g.setTimeout = () => 0;                              // 防抖不真跑，测试自己控节奏
  g.clearTimeout = () => {};
  g.esc = x => String(x == null ? '' : x);
  g.toast = m => TOASTS.push(m);
  g.render = () => {}; g.navReset = () => {};
  g.leavesOf = t => (t && t.leaves) || [];
  const 本地写盘 = [];
  g.Store = { load: async () => ({ name: '本地树', leaves: [], children: [] }),
              save: async (d) => { 本地写盘.push(d); } };
  g.DATA = { name: '本机那份', leaves: [{ name: 'a', desc: 'x' }], children: [] };
  g.curPath = []; g.curLeaf = 0;

  const api = new Function(loadCloud() + `
    return { Cloud, 云上按, 云登录认人, 画分区, 开云面板,
             // 老版本没有 查名字并画（它是这次修复加的）—— 退化成等价动作，
             // 好让这套测试能拿去跑「修复前」的前端，亲眼看见断言把 bug 抓住。
             查名字并画: (typeof 查名字并画 === "function")
               ? 查名字并画
               : async (名) => { try { const d = await Cloud.查分区(名); 画分区(d.占用); } catch (e) { 画分区([]); } },
             手选: () => 分区手选 };`)();

  const 复原 = () => { for (const k of Object.keys(存)) { if (存[k] === undefined) delete g[k]; else g[k] = 存[k]; } };
  const 高亮 = () => env.BTN.filter(b => b.classList.contains('on')).map(b => b.dataset.p).join(',') || '(无)';
  const 有主 = () => env.BTN.filter(b => b.classList.contains('cand')).map(b => b.dataset.p).join(',') || '(无)';
  const 点 = p => { const b = env.BTN.find(x => x.dataset.p === p); assert(b, '没找到分区按钮 ' + p); b.onclick(); };
  const 填 = (名, 令) => {                                // 懒创建：别假设元素已被访问过
    env.document.getElementById('cloudName').value = 名;
    env.document.getElementById('cloudPass').value = 令;
  };
  return { api, env, srv, TOASTS, 复原, 高亮, 有主, 点, 填, 本地写盘 };
}

// ── 5) 断言 ──────────────────────────────────────────────────────────────
let 通过 = 0, 失败 = 0;
function ok(标题, fn) {
  try { fn(); console.log('  ✓ ' + 标题); 通过++; }
  catch (e) { console.log('  ✗ ' + 标题 + '\n      ' + e.message); 失败++; }
}
const 不含 = (s, 片段) => assert(!String(s).includes(片段), `不该出现「${片段}」，实际：${s}`);

(async () => {
  console.log('云端登录自测（不联网，fetch 由假服务器接管）\n');

  // ── 默认高亮：老用户 vs 新名字 ──
  {
    const c = 起云();
    try {
      await c.api.查名字并画('Urgestalt', 'login');          // 这个名字在「流」有账号
      ok('登录：默认高亮指向「有主的那个区」，不是第一个空区', () => {
        assert.strictEqual(c.高亮(), '流', '高亮错成了 ' + c.高亮());
        assert.strictEqual(c.有主(), '流');
      });
      ok('默认高亮只是提示 —— 分区手选仍为空（用户没亲手点）', () => {
        assert.strictEqual(c.api.手选(), '');
      });
    } finally { c.复原(); }
  }
  {
    const c = 起云();
    try {
      await c.api.查名字并画('新来的', 'login');             // 没人用过这个名字
      ok('新名字：默认高亮指向第一个空区（给注册用）', () => {
        assert.notStrictEqual(c.高亮(), '流', '不该高亮别人的区');
        assert.strictEqual(c.高亮(), '通');
        assert.strictEqual(c.有主(), '(无)');
      });
    } finally { c.复原(); }
  }

  // ── 报错文案：分区错 ≠ 口令错（本套的主角）──
  {
    const c = 起云();
    try {
      await c.api.查名字并画('Urgestalt', 'login');
      c.点('通');                                          // 用户误点空区
      c.填('Urgestalt', '123223');                         // ★ 密码是对的
      c.TOASTS.length = 0;
      await c.api.云上按('login');
      const t = c.TOASTS.join(' | ');
      ok('分区选错 → 说「区里没这个账号」，并指出用户在哪个区', () => {
        assert(t.includes('没有'), '应说明这个区里没有该账号，实际：' + t);
        assert(t.includes('流'), '应点出账号所在的区，实际：' + t);
      });
      ok('★ 分区选错 → 绝不喊「口令不对」（口令明明是对的）', () => 不含(t, '口令不对'));
      ok('分区选错 → 提示里带上正确的区、且已替用户选中', () => {
        assert(t.includes('已替你选中'), '应替用户选中正确的区，实际：' + t);
        assert.strictEqual(c.高亮(), '流');
        assert.strictEqual(c.api.手选(), '流');
      });
      ok('分区选错 → 没有误判成登录成功', () => assert.strictEqual(c.api.Cloud.on(), false));
    } finally { c.复原(); }
  }
  {
    const c = 起云();
    try {
      await c.api.查名字并画('Urgestalt', 'login');
      c.点('流');                                          // 分区对
      c.填('Urgestalt', 'wrongpass123');                   // 口令错（≥6 位，免得被前置校验挡下）
      c.TOASTS.length = 0;
      await c.api.云上按('login');
      const t = c.TOASTS.join(' | ');
      ok('口令确实错（401）→ 才说「口令不对」', () => {
        assert(t.includes('口令不对'), '实际：' + t);
        assert.strictEqual(c.api.Cloud.on(), false);
      });
    } finally { c.复原(); }
  }

  // ── 已登录时再点一次，失败也不能让人以为掉线 ──
  {
    const c = 起云();
    try {
      await c.api.查名字并画('Urgestalt', 'login');
      c.点('流'); c.填('Urgestalt', '123223');
      await c.api.云上按('login');
      assert.strictEqual(c.api.Cloud.on(), true, '前置：应当已登录成功');
      const 区 = c.api.Cloud.分区;
      assert.strictEqual(区, '流');
      c.点('通');                                          // 再误点一个空区
      c.填('Urgestalt', '123223');
      c.TOASTS.length = 0;
      await c.api.云上按('login');
      const t = c.TOASTS.join(' | ');
      ok('已登录后再失败 → 提示里说明「没掉线」，令牌仍在', () => {
        assert(t.includes('没掉线'), '实际：' + t);
        assert.strictEqual(c.api.Cloud.on(), true, '不该把已登录状态弄丢');
        assert.strictEqual(c.api.Cloud.用户名, 'Urgestalt');
      });
      ok('已登录后再失败 → 同样不说「口令不对」', () => 不含(t, '口令不对'));
    } finally { c.复原(); }
  }

  // ── 正常路径：不点分区（让服务端按名字＋口令认人）──
  {
    const c = 起云();
    try {
      await c.api.查名字并画('Urgestalt', 'login');
      c.填('Urgestalt', '123223');                         // 分区手选为空 → 走 云登录认人
      c.TOASTS.length = 0;
      await c.api.云上按('login');
      ok('不点分区直接登录 → 成功，且分区由服务端认出来', () => {
        assert.strictEqual(c.api.Cloud.on(), true, 'toast: ' + c.TOASTS.join(' | '));
        assert.strictEqual(c.api.Cloud.用户名, 'Urgestalt');
        assert.strictEqual(c.api.Cloud.分区, '流');
        const 话 = c.TOASTS.join(' | ');
        // ★ 手上那份与云端不一样时，现在会先弹冲突窗问一句；无论选哪边，
        //   都不该出现「没成」这种把成功说成失败的话
        assert(话.includes('云端'), '应当说明树取自云端，实际：' + 话);
        assert(!话.includes('没成'), '不该说「没成」——登录是成功的，实际：' + 话);
      });
      ok('登录成功后密码框被清空（别把口令留在界面上）', () => {
        assert.strictEqual(c.env.els.cloudPass.value, '');
      });
    } finally { c.复原(); }
  }

  // ── 同名跨多区（409）→ 拿同一个口令逐个候选区试 ──
  {
    const c = 起云();
    try {
      c.srv.剧本.占用 = ['通', '流'];                       // 同名占两个区
      c.srv.剧本.口令 = '123223';
      const d = await c.api.云登录认人('Urgestalt', '123223');
      ok('同名跨多区（409）→ 口令对上哪个区就是哪个', () => {
        assert.strictEqual(d.part, '通', '应当认到第一个候选区「通」，实际：' + d.part);
      });
    } finally { c.复原(); }
  }
  {
    const c = 起云();
    try {
      c.srv.剧本.占用 = ['通', '流'];
      let 抛了 = null;
      try { await c.api.云登录认人('Urgestalt', '全都不对'); } catch (e) { 抛了 = e; }
      ok('同名跨多区且口令全不对 → 抛 401「口令不对」并保留候选', () => {
        assert(抛了, '应当抛错');
        assert.strictEqual(抛了.状态, 401);
        assert.deepStrictEqual(抛了.回话.候选, ['通', '流']);
      });
    } finally { c.复原(); }
  }

  // ── 结构性规则 ──
  {
    const c = 起云();
    try {
      ok('16 个分区，一个不多一个不少，且顺序就是广韵十六摄', () => {
        const 期望 = ['通', '江', '止', '遇', '蟹', '臻', '山', '效', '果', '假', '宕', '梗', '曾', '流', '深', '咸'];
        assert.deepStrictEqual(c.api.Cloud.地址 ? null : null, null);
        const 段 = loadCloud();
        const m = 段.match(/const CLOUD_PARTS=\[([^\]]*)\]/);
        assert(m, '找不到 CLOUD_PARTS');
        assert.deepStrictEqual(m[1].split(',').map(s => s.trim().replace(/^"|"$/g, '')), 期望);
      });
      ok('云端地址是内置常量，界面上没有可填的地址栏', () => {
        const 段 = loadCloud();
        assert(/CLOUD_DEFAULT\s*=\s*"https?:\/\//.test(段), '应有一个内置的 CLOUD_DEFAULT');
        assert(!/cloudUrl|cloudAddr/.test(段), '不该有地址输入框相关的 id');
      });
      ok('云登录认人：409 才试候选，别的状态码原样抛出（别吞掉真错误）', async () => {
        const 段 = loadCloud();
        assert(段.includes('if(e.状态!==409'), '应当只对 409 做候选重试');
      });
    } finally { c.复原(); }
  }

  // ── ★ 用户实际踩的坑：登录时「旧树自动覆盖了新树」 ──
  //    以前 登录之后() 里是「云端非空 → 直接 DATA=t.tree」，手上的树看都不看就没了。
  {
    const c = 起云();
    try {
      冲突答复 = null;                                   // 不自动应答 → 应当**卡在弹窗上**等人选
      await c.api.查名字并画('Urgestalt', 'login');
      c.点('流'); c.填('Urgestalt', '123223');
      const p = c.api.云上按('login');
      await 等一下(5);
      ok('★ 两边都有树且不一样 → 必须弹窗问，不许默默覆盖', () => {
        assert.strictEqual(c.env.els.cloudConflict.classList.contains('show'), true,
          '没弹窗就等于默默把用户的树换掉了');
      });
      点冲突('theirs');                                  // 事后替用户点「取云端的」
      await p;
      ok('选了「取云端的」→ 换成云端那份，且本地镜像同步更新', () => {
        assert.strictEqual(globalThis.DATA.name, '逆生树');
        assert(c.本地写盘.length > 0, '本地那份应当被同步写过（否则它会悄悄过期）');
        assert.strictEqual(c.本地写盘[c.本地写盘.length - 1].name, '逆生树');
      });
    } finally { 冲突答复 = 'theirs'; c.复原(); }
  }
  {
    const c = 起云();
    try {
      冲突答复 = 'mine';                                 // 替用户点「用我的覆盖」
      await c.api.查名字并画('Urgestalt', 'login');
      c.点('流'); c.填('Urgestalt', '123223');
      c.TOASTS.length = 0;
      await c.api.云上按('login');
      ok('选了「用我的覆盖」→ 手上的树不被换掉，并上传云端', () => {
        assert.strictEqual(globalThis.DATA.name, '本机那份', '手上的树不该被换掉');
        assert(c.srv.剧本.请求.some(x => x.startsWith('PUT /api/tree')), '应当把它传上云端');
      });
    } finally { 冲突答复 = 'theirs'; c.复原(); }
  }
  {
    const c = 起云();
    try {
      冲突答复 = 'theirs';
      await c.api.查名字并画('Urgestalt', 'login');
      c.点('流'); c.填('Urgestalt', '123223');
      // 把手上这份换成与云端**逐字节相同**的树，再登录
      globalThis.DATA = { name: '逆生树', leaves: [{ name: '概述', desc: '逆生树…' }], children: [] };
      c.TOASTS.length = 0;
      await c.api.云上按('login');
      const 话 = c.TOASTS.join(' | ');
      ok('两边一模一样时不打扰用户（不弹冲突窗，也不白问一遍）', () => {
        assert(话.includes('一模一样'), '实际：' + 话);
        assert(!话.includes('没成'), '实际：' + 话);
      });
      ok('两边一样时不做多余的写盘', () => {
        assert.strictEqual(c.本地写盘.length, 0, '一样就不该再写一遍本地');
      });
    } finally { 冲突答复 = 'theirs'; c.复原(); }
  }

  console.log(`\n结果：通过 ${通过}，失败 ${失败}`);
  process.exit(失败 ? 1 : 0);
})();
