# Computer Use 同意协议 Prompt（浏览器采集）

## 任务

规定浏览器 computer use 采集的同意流程、只读白名单、资源上限、每屏落盘要求与中断方式。没有同意就不动手：`--consent <token>` 缺失时命令以 `exit 2` 结束，回执写"等待用户同意"。

---

## 1. 先问再动（同意协议）

动手前必须向用户说明并等待明确同意：

1. **要访问什么**：具体站点与页面（列表形式），不是"某个平台"这种笼统说法。
2. **要拿什么**：只看指定页面上的公开内容；不点私信、不进设置页、不下载附件。
3. **资源上限**：默认 **≤20 屏 / ≤10 分钟 / 每分钟 ≤6 次滚动**；需要更多必须先说明理由并再次征求同意。
4. **会不会落盘**：每屏都会落盘原文 + URL + 时间 + 截图；截图只存本地 `/tmp/dst-evidence/<pr>/`，不入库（契约 §4：截图/回执/diff 图不提交）。
5. **怎么停**：用户随时可以说停；每次滚动、每次翻屏之间检查一次中断信号。

得到同意后：

- 用 `distilly consent grant` 记录授权（保存在 `~/.distilly/consent.json`）。
- 用 `distilly collect x --mode browser --consent <token>` 执行采集（渠道按契约表选择）。
- 用户可用 `distilly consent list` 查看、用 `distilly consent revoke` 撤销。

**没有 token 就退出**：不要复用旧 token、不要改走别的抓取方式、不要让用户手抄页面内容冒充采集结果。

---

## 2. 只读白名单

- 只允许访问用户在同意里逐条列出的 URL；遇到跳转到其他站点、登录墙或验证码，停下来问。
- 只读：不提交表单、不发消息、不点赞、不关注、不改设置、不下载附件。
- 只采集页面正文与页面自带的公开链接；不猜测隐藏接口。
- 同一页面重复抓取视为浪费额度，先看账本里是否已有该 URL。

---

## 3. 每屏落盘

每一屏（每次滚动后的可视区域）都必须落盘四件东西：

| 落盘内容 | 位置 |
|----------|------|
| 页面原文（归一化文本，带段落锚点 `[k00NN]` / `[k00NN:tM]`） | `knowledge/text/<source>.md` |
| 原样字节（如需保留页面快照） | `knowledge/raw/<source>/...`（只增不改） |
| URL + 抓取时间 + 方法 | `knowledge/index.json` 的账本条目（`origin`、`fetched_at`、`method`、`credentialed`、`warnings[]`） |
| 截图 | 本地 `/tmp/dst-evidence/<pr>/`（不入库） |

采集完成后：先跑 `distilly retrospect`，再读 `evidence/derived/*.json`；用 `distilly doctor` 复核 computer-use 占比与锚点回指率。用户后来补的截图或文字用 `distilly note --from <file|->` 登记，或 `distilly harvest` 入库。

---

## 4. 失败与中断

- 用户说停：立即停止，把已经采集到的部分按上面第 3 节落盘并如实汇报"采了多少屏、停在哪里"。
- 登录态失效 / 风控 / 验证码：停下报告，让用户决定是否重新登录或改走导出包。
- 页面结构与预期不符：报告差异，不要猜测内容，也不要用泛化链接充数。
- 达到上限（20 屏 / 10 分钟 / 每分钟 6 次滚动）：停下问用户是否续期，不要自行加量。
- 任何失败都写进 `warnings[]` / `unavailable[]`，不得静默降级。

---

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写结论。
2. 每条结论跟 `文件 + 锚点`（`[k00NN]` 或 `[k00NN:tM]`）。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 动手前先拿到明确同意，并用 `distilly consent grant` 记录；执行时带 `--consent <token>`。
5. 遵守默认上限 ≤20 屏 / ≤10 分钟 / 每分钟 ≤6 次滚动，并在每屏之间检查中断信号。
6. 每屏落盘原文 + URL + 时间 + 截图（截图只落本地），并让账本可回指。

## 禁止

1. 禁止无证据推断：没抓到的内容不能凭印象补写。
2. 禁止改写引文；长段原文、完整 transcript、完整字幕一律不得进仓库。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；浏览器采集只走 `distilly collect`。
5. 禁止把候选（candidate）当结论。
6. 禁止在没有 `--consent <token>` 时继续，禁止超出白名单页面，禁止写入型操作（发消息、点赞、改设置、下载附件）。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执或 `knowledge/index.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 采了多少屏、是否触达上限、哪些步骤没跑、为什么。

---

## English

### Task

Define the consent flow, read-only whitelist, resource ceilings, per-screen persistence, and interruption rules for browser computer use. Never act without consent: when `--consent <token>` is missing the command ends with `exit 2` and its receipt says it is waiting for user consent.

### 1. Ask before acting (consent protocol)

Before touching anything, explain and wait for explicit consent:

1. **What will be visited**: specific sites and pages, listed one by one — not a vague "some platform".
2. **What will be taken**: only public content on those pages; no private messages, no settings pages, no attachment downloads.
3. **Resource ceiling**: default **≤20 screens / ≤10 minutes / ≤6 scrolls per minute**; anything more needs a stated reason and a fresh consent round.
4. **What gets persisted**: every screen persists raw text + URL + timestamp + screenshot; screenshots stay local in `/tmp/dst-evidence/<pr>/` and are never committed (contract §4: screenshots, receipts, and diff images are not committed).
5. **How to stop**: the user may stop at any time; check the interrupt signal between every scroll and every screen.

After consent:

- Record the grant with `distilly consent grant` (stored in `~/.distilly/consent.json`).
- Collect with `distilly collect x --mode browser --consent <token>` (pick the channel from the contract table).
- The user can inspect it with `distilly consent list` and withdraw it with `distilly consent revoke`.

**No token means exit**: never reuse an old token, never switch to another scraping route, and never have the user hand-copy page content and pass it off as collected material.

### 2. Read-only whitelist

- Visit only the URLs the user listed in the consent; on a redirect to another site, a login wall, or a CAPTCHA, stop and ask.
- Read only: no form submissions, no messages, no likes, no follows, no settings changes, no attachment downloads.
- Collect only the page body and the public links on it; never guess at hidden endpoints.
- Re-fetching the same page wastes budget: check the ledger for that URL first.

### 3. Per-screen persistence

Every screen (the visible region after each scroll) persists four things:

| Artifact | Location |
|----------|----------|
| Page text (normalized, with paragraph anchors `[k00NN]` / `[k00NN:tM]`) | `knowledge/text/<source>.md` |
| Raw bytes (when a page snapshot must be kept) | `knowledge/raw/<source>/...` (append-only) |
| URL + fetch time + method | the ledger entry in `knowledge/index.json` (`origin`, `fetched_at`, `method`, `credentialed`, `warnings[]`) |
| Screenshot | local `/tmp/dst-evidence/<pr>/` (never committed) |

After collection: run `distilly retrospect` first, then read `evidence/derived/*.json`, and re-check the computer-use share and anchor back-reference rate with `distilly doctor`. Text or screenshots added by the user later are registered with `distilly note --from <file|->` or `distilly harvest`.

### 4. Failure and interruption

- The user says stop: stop immediately, persist what was collected per section 3 above, and report honestly "how many screens, and where it stopped".
- Expired login / anti-bot challenge / CAPTCHA: stop and report; let the user decide whether to sign in again or switch to an export bundle.
- The page does not match expectations: report the difference; never guess at content and never pad with generic links.
- Ceiling reached (20 screens / 10 minutes / 6 scrolls per minute): stop and ask whether to extend; never raise it unilaterally.
- Every failure goes into `warnings[]` / `unavailable[]`; nothing degrades silently.

### MUST

1. First list which files were read, how many rows each, and how many anchors; only then write conclusions.
2. Every conclusion carries `file + anchor` (`[k00NN]` or `[k00NN:tM]`).
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Get explicit consent before acting and record it with `distilly consent grant`; execute with `--consent <token>`.
5. Respect the default ceiling of ≤20 screens / ≤10 minutes / ≤6 scrolls per minute, and check the interrupt signal between screens.
6. Persist raw text + URL + timestamp + screenshot per screen (screenshots stay local) and keep the ledger able to back-reference them.

### MUST NOT

1. No evidence-free inference: content that was never captured is never reconstructed from memory.
2. Never rewrite quotations; long passages, full transcripts, and full subtitles never enter the repository.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; browser collection goes only through `distilly collect`.
5. Never present a candidate as a conclusion.
6. Never continue without `--consent <token>`, never leave the whitelisted pages, and never perform write actions (messages, likes, settings changes, attachment downloads).

### RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt or `knowledge/index.json`).
- Which channels were unavailable (`unavailable[]`).
- How many screens were captured, whether a ceiling was hit, which steps were skipped, and why.
