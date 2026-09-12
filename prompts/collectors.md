# 采集命令 Prompt（什么时候用哪条命令）

## 任务

决定本次蒸馏的每个来源走哪条命令、需不需要凭据、失败时怎么办，以及采集完成后 LLM 该读什么。命令名与 `docs/v2/CONTRACT.md` §1 的命令表逐字一致；不要发明子命令或字段。

---

## 1. 命令选择表

| 来源 | 命令 | 凭据 |
|------|------|------|
| 本地目录 / 文件 | `distilly harvest <dir\|file>` | 无 |
| ChatGPT / Claude / Slack / Telegram / Discord 导出 | `distilly parse-chat <export.json>` | 无 |
| 邮件 `.eml` / `.mbox` | `distilly parse-email <x.eml\|.mbox>` | 无 |
| 字幕 `.srt` / `.vtt` | `distilly parse-subtitle <x.srt\|.vtt>` | 无 |
| 文档 `.docx` / `.xlsx` / `.pdf` | `distilly parse-doc <x.docx\|xlsx\|pdf>` | 无 |
| 归档 `.zip` / 目录（X 官方归档、Takeout、社交平台导出） | `distilly parse-archive <x.zip\|dir>` | 无 |
| 音视频 | `distilly transcribe <audio\|video>` | 可选后端（OpenAI 兼容 HTTP 或宿主能力） |
| 飞书 / Slack / 钉钉 / X / Discord / Reddit / Notion / Gmail | `distilly collect <feishu\|slack\|dingtalk\|x\|discord\|reddit\|notion\|gmail>` | key / OAuth |
| 浏览器 computer use | `distilly collect x --mode browser --consent <token>` | 同意 token（见 `prompts/computer-use.md`） |
| 用户直接粘贴的文字 / 截图 | `distilly note --from <file\|->` | 无（`method:"model-read"`） |

选择顺序：**先零凭据，再凭据渠道，最后 computer use**。已经有导出包或本地文件时，不要为了"更全"去动账号。

---

## 2. 需要 key 的渠道：先征求同意

1. 说明三件事：要读哪个渠道、能拿到什么（消息 / 文档 / 表格）、范围（谁的数据、大概多少条）。
2. 说明凭据从哪来：只从 `~/.distilly/*_config.json` 或环境变量读取；回执、日志、对话里只出现配置文件名，永不出现值。
3. 得到明确同意后再执行 `distilly consent grant`，然后 `distilly collect <channel>`。
4. 用户可以用 `distilly consent list` 查看已授予的范围，用 `distilly consent revoke` 撤销。
5. 用户不同意或没配置凭据时：该渠道进 `unavailable[]`，并在汇报里给出补救步骤，然后改走零凭据路径（上传导出 / 粘贴 → `distilly note --from <file|->`）。

---

## 3. 失败时的行为

- 命令非零退出：把**命令原文 + stderr + 补救步骤**一起报给用户，然后停下等指示。
- 绝不静默降级、绝不伪造来源：没有拿到的渠道就写进 `unavailable[]`，并在 `warnings[]` 里说明原因。
- 缺凭据 → 说清要配置哪个配置文件；登录态失效 → 说明需要用户重新登录，不要反复重试刷屏。
- 部分成功（例如消息拿到、文档被权限拦住）：逐项说明哪一部分落地、哪一部分没有，不要把部分当全部。
- 采集后账本是唯一事实来源：`knowledge/index.json` 里没有条目的东西不算已落地来源。

---

## 4. 采集之后 LLM 读什么

1. `knowledge/index.json` —— 账本，每条来源的 `id`、`kind`、`origin`、`fetched_at`、`bytes`、`sha256`、`credentialed`、`method`、`warnings[]`。
2. `knowledge/text/<source>.md` —— 归一化正文，段落锚点形如 `[k0012]` / `[k0012:t3]`。
3. `knowledge/raw/<source>/...` —— 原样字节，只读、只增不改，不要改写或删除。
4. 先跑 `distilly retrospect`，再读 `evidence/derived/*.json`（每条结论带 evidence 锚点）。
5. 最后用 `distilly doctor` 看证据覆盖率、不可用渠道、锚点回指率、computer-use 占比。
6. 引用规范与"事实 / 候选"的区分见 `prompts/retrospection.md`。

---

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写结论。
2. 每条结论跟 `文件 + 锚点`（`[k00NN]` 或 `[k00NN:tM]`），例如 `knowledge/text/feishu.md [k0042]`。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 选命令前先判断凭据需求；需要 key / OAuth 的渠道先征求同意，再 `distilly collect`。
5. 采集完成后按上面第 4 节顺序读文件，并用 `distilly doctor` 复核。
6. 渠道不可用时如实写 `unavailable[]`，并给用户替代路径。

## 禁止

1. 禁止无证据推断：没采到的内容不能凭印象补写。
2. 禁止改写引文；长段原文、完整 transcript、完整字幕一律不得进仓库。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；所有网络采集只走 `distilly collect` / `distilly harvest` / `distilly transcribe`。
5. 禁止把候选（candidate）当结论，尤其是只有 permalink 还没核对的公开帖。
6. 禁止在用户没同意时用浏览器或账号去抓取，也禁止绕过 `--consent <token>`。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执或 `knowledge/index.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些步骤没跑、为什么。

---

## English

### Task

Decide which command each source goes through, whether it needs credentials, what to do when it fails, and what the model reads afterwards. Command names match the command table in `docs/v2/CONTRACT.md` §1 word for word; never invent subcommands or fields.

### 1. Command selection

| Source | Command | Credentials |
|--------|---------|-------------|
| Local directory / file | `distilly harvest <dir\|file>` | none |
| ChatGPT / Claude / Slack / Telegram / Discord export | `distilly parse-chat <export.json>` | none |
| Email `.eml` / `.mbox` | `distilly parse-email <x.eml\|.mbox>` | none |
| Subtitles `.srt` / `.vtt` | `distilly parse-subtitle <x.srt\|.vtt>` | none |
| Documents `.docx` / `.xlsx` / `.pdf` | `distilly parse-doc <x.docx\|xlsx\|pdf>` | none |
| Archive `.zip` / directory (X archive, Takeout, social exports) | `distilly parse-archive <x.zip\|dir>` | none |
| Audio / video | `distilly transcribe <audio\|video>` | optional backend (OpenAI-compatible HTTP or host capability) |
| Feishu / Slack / DingTalk / X / Discord / Reddit / Notion / Gmail | `distilly collect <feishu\|slack\|dingtalk\|x\|discord\|reddit\|notion\|gmail>` | key / OAuth |
| Browser computer use | `distilly collect x --mode browser --consent <token>` | consent token (see `prompts/computer-use.md`) |
| Text or screenshots the user pastes | `distilly note --from <file\|->` | none (`method:"model-read"`) |

Order: **zero-credential first, credentialed channels second, computer use last**. When an export bundle or local file already exists, do not touch an account "for completeness".

### 2. Channels that need a key: ask for consent first

1. State three things: which channel will be read, what it yields (messages / documents / spreadsheets), and the scope (whose data, roughly how much).
2. State where credentials come from: only `~/.distilly/*_config.json` or environment variables; receipts, logs, and chat only ever contain the config file name, never a value.
3. Only after explicit consent, run `distilly consent grant` and then `distilly collect <channel>`.
4. The user can inspect the granted scope with `distilly consent list` and withdraw it with `distilly consent revoke`.
5. Without consent or without credentials: put the channel into `unavailable[]`, report the remedy, and switch to a zero-credential route (upload an export / paste → `distilly note --from <file|->`).

### 3. Behavior on failure

- Non-zero exit: report the **exact command + stderr + remedy** and stop for instructions.
- Never degrade silently and never fabricate a source: channels that did not land go into `unavailable[]`, with the reason in `warnings[]`.
- Missing credentials → name the config file to set up; expired login → tell the user to sign in again instead of retrying in a loop.
- Partial success (messages landed, documents blocked by permissions): report each part separately; never present a part as the whole.
- After collection the ledger is the only source of truth: anything without an entry in `knowledge/index.json` is not a grounded source.

### 4. What the model reads afterwards

1. `knowledge/index.json` — the ledger: `id`, `kind`, `origin`, `fetched_at`, `bytes`, `sha256`, `credentialed`, `method`, `warnings[]` per source.
2. `knowledge/text/<source>.md` — normalized text with paragraph anchors such as `[k0012]` / `[k0012:t3]`.
3. `knowledge/raw/<source>/...` — raw bytes, read-only and append-only; never rewrite or delete them.
4. Run `distilly retrospect` first, then read `evidence/derived/*.json` (every conclusion carries evidence anchors).
5. Finish with `distilly doctor` for evidence coverage, unavailable channels, anchor back-reference rate, and computer-use share.
6. Citation rules and the fact/candidate split live in `prompts/retrospection.md`.

### MUST

1. First list which files were read, how many rows each, and how many anchors; only then write conclusions.
2. Every conclusion carries `file + anchor` (`[k00NN]` or `[k00NN:tM]`), e.g. `knowledge/text/feishu.md [k0042]`.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Check credential needs before choosing a command; channels needing a key or OAuth require consent first, then `distilly collect`.
5. After collection, read the files in the order of section 4 above and re-check with `distilly doctor`.
6. When a channel is unavailable, record it in `unavailable[]` honestly and give the user an alternative route.

### MUST NOT

1. No evidence-free inference: content that was never collected is never reconstructed from memory.
2. Never rewrite quotations; long passages, full transcripts, and full subtitles never enter the repository.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes only through `distilly collect` / `distilly harvest` / `distilly transcribe`.
5. Never present a candidate as a conclusion, especially a public post whose permalink has not been verified.
6. Never scrape with a browser or an account without the user's consent, and never bypass `--consent <token>`.

### RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt or `knowledge/index.json`).
- Which channels were unavailable (`unavailable[]`).
- Which steps were skipped, and why.
