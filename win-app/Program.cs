// 倒生树 —— 完全独立的 Windows 桌面应用（不依赖 WSL / Node）
//
// 内置一个微型 HTTP 服务（基于 TcpListener，无需管理员权限），
// 用 WebView2 显示界面；内容文件（data.json / index.html / media/）放在 exe 同目录。
// 整个文件夹可拷到任何 Windows 电脑运行（需系统已装 WebView2 运行时，Win10/11 通常自带）。
//
// 编译（Windows 侧，C# 5 / csc.exe）：
//   csc.exe /target:winexe /platform:x86 /codepage:65001 /out:DaoShengTree.exe
//     /reference:System.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll
//     /reference:Microsoft.Web.WebView2.Core.dll /reference:Microsoft.Web.WebView2.WinForms.dll
//     Program.cs
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

static class Program
{
    const string AppTitle = "ArborInversa";

    static string BaseDir;   // exe 所在目录（内容文件所在处）
    static int    Port;      // 自动分配的空闲端口

    // ── DPI 感知：避免文字被系统位图拉伸而发虚 ──────────────
    [DllImport("user32.dll", SetLastError = true)]
    static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")]
    static extern bool SetProcessDPIAware();

    static void EnableDpiAwareness()
    {
        try { if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return; }
        catch { }
        try { SetProcessDPIAware(); } catch { }
    }

    // ══════════════════ 微型 HTTP 服务 ══════════════════

    static void StartServer()
    {
        TcpListener listener = new TcpListener(IPAddress.Loopback, 0);   // 0 = 自动选空闲端口
        listener.Start();
        Port = ((IPEndPoint)listener.LocalEndpoint).Port;

        Thread t = new Thread(delegate()
        {
            while (true)
            {
                try
                {
                    TcpClient c = listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(new WaitCallback(HandleClient), c);
                }
                catch { }
            }
        });
        t.IsBackground = true;
        t.Start();
    }

    static int FindCrLfCrLf(byte[] b, int len)
    {
        for (int i = 0; i + 3 < len; i++)
            if (b[i] == 13 && b[i + 1] == 10 && b[i + 2] == 13 && b[i + 3] == 10) return i;
        return -1;
    }

    static void HandleClient(object state)
    {
        TcpClient client = (TcpClient)state;
        try
        {
            using (client)
            {
                client.ReceiveTimeout = 10000;
                client.SendTimeout    = 10000;
                NetworkStream ns = client.GetStream();

                MemoryStream ms = new MemoryStream();
                byte[] buf = new byte[8192];
                int headerEnd = -1;
                while (headerEnd < 0)
                {
                    int n = ns.Read(buf, 0, buf.Length);
                    if (n <= 0) return;
                    ms.Write(buf, 0, n);
                    byte[] cur = ms.ToArray();
                    headerEnd = FindCrLfCrLf(cur, cur.Length);
                    if (cur.Length > 65536) return;
                }

                byte[] data = ms.ToArray();
                string head = Encoding.UTF8.GetString(data, 0, headerEnd);
                string[] lines = head.Split(new string[] { "\r\n" }, StringSplitOptions.None);
                if (lines.Length == 0) return;

                string[] reqLine = lines[0].Split(' ');
                if (reqLine.Length < 2) return;
                string method = reqLine[0].ToUpperInvariant();
                string path   = reqLine[1];

                int contentLength = 0;
                for (int i = 1; i < lines.Length; i++)
                {
                    int c = lines[i].IndexOf(':');
                    if (c > 0)
                    {
                        string k = lines[i].Substring(0, c).Trim().ToLowerInvariant();
                        if (k == "content-length")
                        {
                            int v;
                            if (int.TryParse(lines[i].Substring(c + 1).Trim(), out v)) contentLength = v;
                        }
                    }
                }

                byte[] body = new byte[0];
                int already = data.Length - (headerEnd + 4);
                if (contentLength > 0)
                {
                    MemoryStream bm = new MemoryStream();
                    if (already > 0) bm.Write(data, headerEnd + 4, already);
                    int remain = contentLength - already;
                    while (remain > 0)
                    {
                        int n = ns.Read(buf, 0, Math.Min(buf.Length, remain));
                        if (n <= 0) break;
                        bm.Write(buf, 0, n);
                        remain -= n;
                    }
                    body = bm.ToArray();
                }

                Route(ns, method, path, body);
            }
        }
        catch { }
    }

    static void SendBytes(NetworkStream ns, int code, string status, string ctype, byte[] body)
    {
        if (body == null) body = new byte[0];
        string head = "HTTP/1.1 " + code + " " + status + "\r\n" +
                      "Content-Type: " + ctype + "\r\n" +
                      "Content-Length: " + body.Length + "\r\n" +
                      "Cache-Control: no-cache\r\n" +
                      "Connection: close\r\n\r\n";
        byte[] hb = Encoding.UTF8.GetBytes(head);
        ns.Write(hb, 0, hb.Length);
        if (body.Length > 0) ns.Write(body, 0, body.Length);
        ns.Flush();
    }

    static void SendText(NetworkStream ns, int code, string status, string ctype, string text)
    {
        SendBytes(ns, code, status, ctype, Encoding.UTF8.GetBytes(text));
    }

    static string MimeOf(string file)
    {
        string e = Path.GetExtension(file).ToLowerInvariant();
        if (e == ".html" || e == ".htm") return "text/html; charset=utf-8";
        if (e == ".json") return "application/json; charset=utf-8";
        if (e == ".js")   return "application/javascript; charset=utf-8";
        if (e == ".css")  return "text/css; charset=utf-8";
        if (e == ".png")  return "image/png";
        if (e == ".jpg" || e == ".jpeg") return "image/jpeg";
        if (e == ".gif")  return "image/gif";
        if (e == ".webp") return "image/webp";
        if (e == ".svg")  return "image/svg+xml";
        if (e == ".bmp")  return "image/bmp";
        if (e == ".avif") return "image/avif";
        return "application/octet-stream";
    }

    static void SendFile(NetworkStream ns, string fullPath, string ctype)
    {
        if (!File.Exists(fullPath))
        {
            SendText(ns, 404, "Not Found", "text/plain; charset=utf-8", "文件不存在");
            return;
        }
        try
        {
            byte[] b = File.ReadAllBytes(fullPath);
            SendBytes(ns, 200, "OK", ctype, b);
        }
        catch (Exception ex)
        {
            SendText(ns, 500, "Internal Server Error", "text/plain; charset=utf-8", ex.Message);
        }
    }

    static void Route(NetworkStream ns, string method, string rawPath, byte[] body)
    {
        string path = rawPath;
        int q = path.IndexOf('?');
        if (q >= 0) path = path.Substring(0, q);

        // 读数据
        if (method == "GET" && path == "/data")
        {
            SendFile(ns, Path.Combine(BaseDir, "data.json"), "application/json; charset=utf-8");
            return;
        }

        // 存数据
        if (method == "POST" && path == "/save")
        {
            try
            {
                string json = Encoding.UTF8.GetString(body);
                if (json.IndexOf("\"name\"") < 0) throw new Exception("数据缺少 name 字段");
                File.WriteAllText(Path.Combine(BaseDir, "data.json"), json, new UTF8Encoding(false));
                SendText(ns, 200, "OK", "application/json; charset=utf-8", "{\"ok\":true}");
            }
            catch (Exception ex)
            {
                SendText(ns, 400, "Bad Request", "application/json; charset=utf-8",
                    "{\"ok\":false,\"error\":\"" + JsonEscape(ex.Message) + "\"}");
            }
            return;
        }

        // 上传图片
        if (method == "POST" && path == "/upload")
        {
            try
            {
                string req  = Encoding.UTF8.GetString(body);
                string name = JsonGetString(req, "name");
                string data = JsonGetString(req, "data");
                if (data == null) throw new Exception("缺少 data");

                int comma = data.IndexOf(',');
                if (data.IndexOf("base64,") < 0 || comma < 0) throw new Exception("不是有效的图片数据");
                byte[] raw = Convert.FromBase64String(data.Substring(comma + 1));

                string ext = "png";
                int slash = data.IndexOf('/');
                int semi  = data.IndexOf(';');
                if (slash > 0 && semi > slash)
                {
                    ext = data.Substring(slash + 1, semi - slash - 1).ToLowerInvariant();
                    if (ext == "jpeg") ext = "jpg";
                    if (ext == "svg+xml") ext = "svg";
                }

                string baseName = SanitizeName(name);
                if (baseName.Length == 0) baseName = "image";
                if (Path.GetExtension(baseName).Length == 0) baseName = baseName + "." + ext;

                string mediaDir = Path.Combine(BaseDir, "media");
                Directory.CreateDirectory(mediaDir);
                string fp = Path.Combine(mediaDir, baseName);
                int n = 1;
                while (File.Exists(fp))
                {
                    string stem = Path.GetFileNameWithoutExtension(baseName);
                    string e2   = Path.GetExtension(baseName);
                    fp = Path.Combine(mediaDir, stem + "_" + (n++) + e2);
                }
                File.WriteAllBytes(fp, raw);
                SendText(ns, 200, "OK", "application/json; charset=utf-8",
                    "{\"ok\":true,\"name\":\"" + JsonEscape(Path.GetFileName(fp)) + "\"}");
            }
            catch (Exception ex)
            {
                SendText(ns, 400, "Bad Request", "application/json; charset=utf-8",
                    "{\"ok\":false,\"error\":\"" + JsonEscape(ex.Message) + "\"}");
            }
            return;
        }

        // 图片访问
        if (method == "GET" && path.StartsWith("/media/"))
        {
            string raw  = Uri.UnescapeDataString(path.Substring("/media/".Length));
            string safe = Path.GetFileName(raw);                       // 防目录穿越
            string fp   = Path.Combine(Path.Combine(BaseDir, "media"), safe);
            SendFile(ns, fp, MimeOf(safe));
            return;
        }

        // 首页
        if (method == "GET" && (path == "/" || path == "/index.html"))
        {
            SendFile(ns, Path.Combine(BaseDir, "index.html"), "text/html; charset=utf-8");
            return;
        }

        SendText(ns, 404, "Not Found", "text/plain; charset=utf-8", "404");
    }

    // ── JSON 小工具（无需第三方库）──────────────────────
    static string SanitizeName(string s)
    {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder();
        foreach (char c in s)
        {
            if (char.IsLetterOrDigit(c) || c == '.' || c == '-' || c == '_') sb.Append(c);
            else if (c > 127) sb.Append(c);      // 保留中文等
            else sb.Append('_');
        }
        return sb.ToString();
    }

    static string JsonEscape(string s)
    {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder();
        foreach (char c in s)
        {
            if (c == '"') sb.Append("\\\"");
            else if (c == '\\') sb.Append("\\\\");
            else if (c == '\n') sb.Append("\\n");
            else if (c == '\r') sb.Append("\\r");
            else if (c == '\t') sb.Append("\\t");
            else if (c < 32) sb.Append(' ');
            else sb.Append(c);
        }
        return sb.ToString();
    }

    static string JsonGetString(string json, string key)
    {
        string pat = "\"" + key + "\"";
        int i = json.IndexOf(pat);
        if (i < 0) return null;
        i = json.IndexOf(':', i + pat.Length);
        if (i < 0) return null;
        i++;
        while (i < json.Length && char.IsWhiteSpace(json[i])) i++;
        if (i >= json.Length || json[i] != '"') return null;
        i++;
        StringBuilder sb = new StringBuilder();
        while (i < json.Length)
        {
            char ch = json[i];
            if (ch == '\\')
            {
                i++;
                if (i >= json.Length) break;
                char e = json[i];
                if (e == 'n') sb.Append('\n');
                else if (e == 'r') sb.Append('\r');
                else if (e == 't') sb.Append('\t');
                else if (e == 'u' && i + 4 < json.Length)
                {
                    int cp;
                    if (int.TryParse(json.Substring(i + 1, 4),
                            System.Globalization.NumberStyles.HexNumber, null, out cp))
                        sb.Append((char)cp);
                    i += 4;
                }
                else sb.Append(e);
            }
            else if (ch == '"') break;
            else sb.Append(ch);
            i++;
        }
        return sb.ToString();
    }

    // ══════════════════ 界面 ══════════════════

    static WebView2 g_web;
    static string   g_url;

    static void LogError(string tag, Exception ex)
    {
        try
        {
            File.AppendAllText(Path.Combine(BaseDir, "error.log"),
                DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " [" + tag + "] " +
                ex.GetType().FullName + ": " + ex.Message + "\r\n" + ex.StackTrace + "\r\n\r\n",
                Encoding.UTF8);
        }
        catch { }
    }

    static async void OnFormLoad(object sender, EventArgs e)
    {
        try
        {
            await g_web.EnsureCoreWebView2Async(null);
            g_web.CoreWebView2.Settings.AreDevToolsEnabled = false;
            g_web.CoreWebView2.Settings.IsStatusBarEnabled = false;
            g_web.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            g_web.CoreWebView2.Settings.IsZoomControlEnabled = true;
            g_web.Source = new Uri(g_url);
        }
        catch (Exception ex)
        {
            LogError("WebView2Init", ex);
            MessageBox.Show(
                "无法启动内嵌页面。\n\n本程序需要系统安装 WebView2 运行时" +
                "（Windows 10/11 通常自带，可到微软官网下载 \"WebView2 Runtime\"）。\n\n" +
                "详细信息见 error.log：\n" + ex.GetType().Name + ": " + ex.Message,
                AppTitle, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    [STAThread]
    static void Main()
    {
        EnableDpiAwareness();

        BaseDir = Path.GetDirectoryName(Application.ExecutablePath);
        if (BaseDir == null || BaseDir.Length == 0)
            BaseDir = Environment.CurrentDirectory;

        // 缺少内容文件时给出明确提示
        if (!File.Exists(Path.Combine(BaseDir, "index.html")) ||
            !File.Exists(Path.Combine(BaseDir, "data.json")))
        {
            MessageBox.Show(
                "未找到内容文件。\n\n请确保 index.html 与 data.json 与本程序放在同一目录：\n" + BaseDir,
                AppTitle, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        StartServer();
        g_url = "http://127.0.0.1:" + Port + "/";

        Form form = new Form();
        form.Text          = AppTitle;
        form.Width         = 1320;
        form.Height        = 880;
        form.MinimumSize   = new Size(720, 480);
        form.StartPosition = FormStartPosition.CenterScreen;
        form.BackColor     = Color.FromArgb(244, 241, 236);

        g_web = new WebView2();
        g_web.Dock = DockStyle.Fill;
        form.Controls.Add(g_web);
        form.Load += OnFormLoad;

        Application.Run(form);
    }
}
