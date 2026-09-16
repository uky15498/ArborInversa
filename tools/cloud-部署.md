# 逆生树 · 云端 —— 给服务器维护者的说明

> 这个文件夹是打包好的成品：一个零依赖的 Node 服务 ＋ 网页文件 ＋ 一键安装脚本。
> 装好后，用户在任何设备打开 `http://<这台机的IP>:端口/` 就是应用，登录自己的账号读写自己的树。

## 一、这是什么

「逆生树」是个树型思维导图应用。这个服务干两件事：

1. **存账号和树**：每个账号一棵树，存成 JSON 文件（没有数据库）
2. **顺便把网页发出去**（`site/` 目录）：这样网页和接口同源，
   **不需要域名、不需要 HTTPS 证书**

```
账号 = 用户名 + 口令 + 分区
分区 = 广韵十六摄（通江止遇蟹臻山效果假宕梗曾流深咸）
       用户名是自己起的，会撞名；16 个区就是 16 个格，
       同名的第 1 个人进「通」、第 2 个进「江」……最多并存 16 个，互不干扰
```

## 二、要求

- **Node ≥ 14**（`node -v` 看一下；自带 `http/https/crypto/fs`，没有任何 npm 依赖，不用 `npm install`）
- **一个对外开放的端口**（默认 8488）；如果用 nginx/caddy 反代，让它监听 127.0.0.1 就行
- 磁盘：数据是纯 JSON，一个账号几十 KB 到几 MB

> ★ 关于备案：**80/443 端口**上跑未备案的域名，国内云厂商会拦。
> 用**非标端口 ＋ IP** 访问（就是本方案）一般不涉及备案，但**安全组／防火墙要放行这个端口**。

## 三、安装

把整个文件夹传到服务器上（例如 `/root/arborinversa-cloud`），然后：

```bash
cd /root/arborinversa-cloud
sudo sh 安装.sh 8488          # 参数是端口，不写就是 8488
```

脚本做这些事（可以反复跑，不会重复建）：

1. 建一个专用系统用户 `arbor`（不能用 root 跑服务）
2. 把程序装到 `/opt/arborinversa-cloud/`，数据放 `/var/lib/arborinversa-cloud/`
3. 注册 systemd 服务 `arborinversa-cloud`，开机自启、崩了自动重启
4. 启动并自检，打印 `{"ok":true,...}`

手动装也行，等价于：

```bash
sudo useradd -r -s /usr/sbin/nologin arbor
sudo mkdir -p /opt/arborinversa-cloud /var/lib/arborinversa-cloud
sudo cp -r site cloud-server.js /opt/arborinversa-cloud/
sudo chown -R arbor:arbor /var/lib/arborinversa-cloud
sudo cp arborinversa-cloud.service /etc/systemd/system/   # 里面端口若不是 8488 记得改
sudo systemctl daemon-reload && sudo systemctl enable --now arborinversa-cloud
```

## 四、验证

```bash
# ① 服务活着吗
curl -s http://127.0.0.1:8488/api/health
#    → {"ok":true,"服务":"arborinversa-cloud","版本":1,"分区":[...16 个],...}

# ② 网页发得出去吗
curl -sI http://127.0.0.1:8488/ | head -3
#    → HTTP/1.1 200 OK / Content-Type: text/html; charset=utf-8

# ③ 从外网（另找一台机器）：
curl -s http://<这台机的公网IP>:8488/api/health
#    → 同上；通不了就是安全组／防火墙没放行
```

浏览器打开 `http://<公网IP>:8488/` 应当直接看到应用。第一次用：点右上角「云」→
填用户名、口令 → 「注册新账号」→ 之后在应用里改东西就会自动存到服务器。

## 五、数据与备份

```
/var/lib/arborinversa-cloud/
  accounts/<区>/<用户名>.json   账号：盐 + scrypt 口令哈希（**不存明文口令**）
  trees/<区>/<用户名>.json      那棵树本身，和 data.json 同构，可以直接拷走看
  .secret                       ★ 签发登录令牌用的密钥 —— 换/丢了这个文件，所有设备都要重新登录
```

备份就是打包这个目录：

```bash
sudo tar czf arborinversa-cloud-$(date +%F).tar.gz -C /var/lib arborinversa-cloud
```

建议加一条 cron/weekly 或者接上你现有的备份机制。**`.secret` 一定要一起备份。**

## 六、日志与运维

```bash
journalctl -u arborinversa-cloud -n 50 --no-pager     # 看日志
sudo systemctl restart arborinversa-cloud             # 重启
sudo systemctl stop arborinversa-cloud                # 停
```

端口、数据目录这些参数都在 systemd 单元的 `ExecStart` 那一行，改完
`systemctl daemon-reload && systemctl restart arborinversa-cloud`。

## 七、安全须知（请照做）

1. **别用 root 跑**（安装脚本已经建了 `arbor`）
2. **不要把这个端口暴露给不信任的网络后又不管**：接口本身有口令哈希、
   登录失败限流、请求体上限，但它**没有 HTTPS** —— 口令和令牌在网络上是明文传输的。
   介意的话两种做法：
   - 用 nginx/caddy 在前面终止 TLS（有域名的话最正规，Let's Encrypt 免费）
   - 或者给它自签证书：`--tls-key key.pem --tls-cert cert.pem`（浏览器首次要点一次「继续访问」）
3. **数据目录不要放进任何 web 静态目录**（本方案已经分开：`site/` 才是公开的）
4. 备份里含口令哈希与 `.secret`，别公开

## 八、这个服务对外提供什么（接口一览）

全部 JSON；写操作要 `Authorization: Bearer <登录时发的令牌>`。
跨域已放开（`Access-Control-Allow-Origin: *`），因为认证用的是 Bearer 令牌而不是 Cookie。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 活着吗、有哪些分区、几个账号 |
| GET | `/api/parts?name=名字` | 这个名字已经在哪些区有账号 |
| POST | `/api/register` | `{name,pass,part?}` 建号；不给 part 自动挑空区 |
| POST | `/api/login` | `{name,pass,part?}` 登入；同名跨多区且没给 part → 409 ＋ 候选 |
| GET | `/api/me` | 我是谁、在哪个区、树多大、最后改于 |
| GET | `/api/tree` | 取树 `{tree,版本,改于}` |
| PUT | `/api/tree` | `{tree,版本}` 存树；版本对不上 → 409（客户端会问用户留哪份） |
| POST | `/api/pass` | `{pass,新pass}` 改口令 |
| GET | `/` 及 `site/` 下的路径 | 网页与插图（公开） |

## 九、如果装不成，我需要你回话的两件事

1. **安全组能不能放行这个端口**？放行后从外网 `curl http://<公网IP>:8488/api/health` 通不通？
   （这条不通，整套就用不了）
2. **能不能加 systemd 服务、用哪个用户跑**？不行的话就用 `nohup`/`screen`/`pm2` 顶上，
   告诉我你倾向哪种。

顺带把这两条的输出发我：`node -v`、`ss -ltnp | grep :8488`（看有没有冲突）。
