// 网页便携版的「存取层」——由 tools/build_web.js 注入到 index.html 前面。
//
// 与 Windows 版／WSL 版的区别只有一处：内容不放在 data.json 里，而是写在
// **这份 HTML 自己末尾**的 <script id="tree-data"> 块里。于是：
//   · 一个文件＝程序 ＋ 内容，拷走就能用，双击（file://）就能开，不需要任何后端
//   · 内容是**树语言文本**，人可读、可 diff、可复制到任何地方
//   · 「保存」＝把内存里的树转回树语言文本，然后覆盖本文件／另存为／复制
//
// 没有后端，所以静态托管也能用：读是读文件里的，写是写回文件或剪贴板。
// 未导出的改动会自动存进浏览器本地（localStorage），下次打开会问你要不要恢复。
(function () {
  var PAYLOAD_ID = "tree-data";
  var DRAFT_KEY = "arborinversa_draft";

  var baseText = "";      // 打开时文件里的内容（用来判断「改没改」）
  var dirty = false;

  // ---- 小工具 ----
  function ready() {                       // 负载块在页面末尾，必须等 DOM 解析完才能读
    return new Promise(function (res) {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", res);
      else res();
    });
  }
  function payloadText() {
    var el = document.getElementById(PAYLOAD_ID);
    if (!el) return "";
    // 容器在负载前后各加了一个换行；内容里的 `</` 在写入时转义成了 `<\/`（否则会截断容器）
    return el.textContent.replace(/<\\\//g, "</").replace(/^\n/, "").replace(/\n$/, "");
  }
  function rootOf(parsed) {                 // 解析结果 → 根枝（兼容「树 名称」写法）
    if (parsed.children && parsed.children.length) return parsed.children[0];
    if (parsed.title) return { name: parsed.title, leaves: parsed.leaves || [], children: [], props: parsed.props };
    return null;
  }
  function toastMsg(m) { if (typeof toast === "function") toast(m); }
  function hint(text) {
    var el = document.getElementById("portableHint");
    if (el) el.textContent = text || "";
  }
  function setDirty(v) {
    dirty = v;
    hint(v ? "· 有改动未导出" : "· 与文件一致");
  }
  function currentText() { return treeToCode(DATA, 0); }

  // ---- 未导出的改动：存浏览器本地，别让它悄悄没了 ----
  function saveDraft(text) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ text: text, base: baseText, at: Date.now() }));
    } catch (e) { /* 隐私模式等存不了就算了，导出仍然可用 */ }
  }
  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { return null; }
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  // ---- 存取层：接管 index.html 里的 /data 与 /save ----
  window.ArborStore = {
    mediaBase: "media/",                   // 图片放在本文件同级的 media/ 目录里
    load: function () {
      return ready().then(function () {
        var raw = payloadText();
        if (!raw.trim()) throw new Error("这份文件末尾没有内嵌的树（tree-data 块是空的）");
        var parsed = codeToTree(raw);
        var root = rootOf(parsed);
        if (!root || !root.name) throw new Error("内嵌的树里没有枝");
        baseText = raw;
        setDirty(false);

        var d = readDraft();
        if (d && d.text && d.text !== raw) {
          var when = new Date(d.at).toLocaleString();
          if (confirm("上次有改动没有导出（" + when + "）。\n\n" +
                      "确定＝接着用那些改动；取消＝用这份 HTML 里的内容。\n" +
                      "（改动仍然留在浏览器里，不会因为选取消就丢掉）")) {
            var back = rootOf(codeToTree(d.text));
            if (back) { saveDraft(d.text); setDirty(true); return back; }
            toastMsg("上次的草稿读不出来，已改用文件里的内容");
          }
        }
        return root;
      });
    },
    save: function (data) {                // 没有后端：存草稿，等用户导出
      try {
        var text = treeToCode(data, 0);
        saveDraft(text);
        setDirty(text !== baseText);
        return true;
      } catch (e) { return false; }
    },
    uploadImage: function () {             // 便携版不上传：图片放同级 media/ 目录即可
      return { ok: false, error: "便携版不带图片上传 —— 把图片放进本文件同级的 media/ 目录，再在叶里写 ![[文件名]]" };
    }
  };

  // ---- 导出 ----
  // 整份 HTML 怎么来：构建脚本在本文件**末尾**（负载块之后）抓一份「解析后、还没渲染」
  // 的页面源码存进 window.__ARBOR_SRC__；导出时只把里面的负载块换掉，其余一字不动。
  // 放在末尾是必须的：抓早了，负载块还没被解析，导出的文件会丢掉内容。

  var TAG_OPEN = "<" + "script", TAG_CLOSE = "</" + "script>";   // 拆开写：内联脚本里不能出现字面量结束标签
  function rebuildHtml(text) {
    var escaped = text.replace(/<\//g, "<\\/");
    var re = new RegExp('(' + TAG_OPEN + ' id="' + PAYLOAD_ID + '"[^>]*>\\n)[\\s\\S]*?(\\n' + TAG_CLOSE + ')');
    if (!re.test(window.__ARBOR_SRC__)) return null;   // 源码结构变了就退回「只导出文本」
    return window.__ARBOR_SRC__.replace(re, function (m, a, b) { return a + escaped + b; });
  }
  function download(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  async function saveAs(blob, name, desc, ext) {
    if (window.showSaveFilePicker) {       // 能选「保存到哪」，可原地覆盖打开的这个文件
      try {
        var h = await window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: desc, accept: (function () { var o = {}; o["text/" + (ext === "html" ? "html" : "plain")] = ["." + ext]; return o; })() }]
        });
        var w = await h.createWritable(); await w.write(blob); await w.close();
        return true;
      } catch (e) {
        if (e && e.name === "AbortError") return false;   // 用户自己取消的
        /* 其它错就退回下载 */
      }
    }
    download(blob, name);
    return true;
  }
  function treeName() { return (DATA && DATA.name) || "树"; }

  window.__arborExport = {
    text: currentText,
    isDirty: function () { return dirty; },
    rebuilt: function (t) { return rebuildHtml(t || currentText()); },   // 自测用：拿到重建后的整份源码
    async copy() {
      var text = currentText(), ta = document.getElementById("exportText");
      if (ta) ta.value = text;
      try { await navigator.clipboard.writeText(text); toastMsg("已复制树语言文本 —— 粘到哪儿都行"); }
      catch (e) {
        try { ta.removeAttribute("readonly"); ta.select(); document.execCommand("copy"); ta.setAttribute("readonly", ""); toastMsg("已复制树语言文本"); }
        catch (e2) { toastMsg("请在上面的框里全选复制"); }
      }
    },
    async txt() {
      var ok = await saveAs(new Blob([currentText()], { type: "text/plain;charset=utf-8" }),
        treeName() + ".txt", "树语言文本", "txt");
      if (ok) toastMsg("已导出文本 —— 它就是你的内容，可以贴回仓库或发给别人");
    },
    async html() {
      var src = rebuildHtml(currentText());
      if (!src) return toastMsg("这份文件的负载块找不到，只能导出文本");
      var ok = await saveAs(new Blob([src], { type: "text/html;charset=utf-8" }),
        treeName() + ".html", "含内容的便携版", "html");
      if (ok) { baseText = currentText(); saveDraft(baseText); setDirty(false); toastMsg("已导出整份 HTML —— 打开它就是现在这个样子"); }
    },
    reset() {                              // 丢掉未导出的改动，回到文件里的内容
      if (!confirm("丢掉还没导出的改动，回到这份 HTML 里的内容？")) return;
      clearDraft();
      baseText = payloadText();
      DATA = rootOf(codeToTree(baseText));
      curPath = []; curLeaf = 0;
      setDirty(false); render();
      toastMsg("已回到文件里的内容");
    }
  };

  // ---- 界面：标题栏加一个「导出」按钮 ＋ 导出面板 ----
  window.addEventListener("load", function () {
    var bar = document.querySelector(".toolbar");
    if (bar && !document.getElementById("btnExport")) {
      var b = document.createElement("button");
      b.id = "btnExport"; b.className = "ghost"; b.textContent = "导出";
      bar.appendChild(b);
      b.onclick = function () {
        var m = document.getElementById("exportModal");
        var ta = document.getElementById("exportText");
        if (ta) ta.value = currentText();
        var w = document.getElementById("exportWhere");
        if (w) w.textContent = "这是一份便携版：内容就写在本文件里，程序不需要联网、不需要后端。" +
          (dirty ? "现在有改动还没导出。" : "现在与文件里的内容一致。");
        m.classList.add("show");
      };
    }
    setDirty(dirty);
  });

  window.addEventListener("beforeunload", function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }   // 有没导出的改动，别让页面说关就关
  });
})();
