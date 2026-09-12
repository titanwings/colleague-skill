# dot-skill v2 · 施工契约

所有 `ds/NN-*` 分支必须遵守。它是各并行任务之间**唯一的接口约定**：接口冻结在这里，实现可以并行。

## 0. 工作方式

- 集成分支：**`dot-skill-test`**（本分支）。每个子任务在自己的 worktree + 分支 `ds/NN-<topic>` 上做，PR 的目标分支一律是 `dot-skill-test`。
- 本地 worktree 命名 `/tmp/dot-skill-test-NN`；一个 worktree 只做一件事。
- **提交原子化**：一个 commit 只做一件事（不要"改样式 + 改文案 + 改 CI"混在一起），conventional commit 前缀（`feat|fix|refactor|test|docs|ci|chore`）。
- 不 push 到 `main` / `dot-skill`；不碰别的任务的**文件清单**（见每个任务说明）。
- Node **>= 20**；**零运行时 npm 依赖**（浏览器自动化用可选 `playwright`，缺失时必须响亮失败 + 给安装指引）。

## 1. 命令契约（唯一入口 `bin/distilly.mjs`）

全部子命令支持 `--json` 回执；`--help` 有中文/英文两段。

```
harvest <dir|file>            零凭据：目录/文件 → knowledge/
parse-chat <export.json>      ChatGPT / Claude / Slack 导出 / Telegram / Discord
parse-email <x.eml|.mbox>
parse-subtitle <x.srt|.vtt>
parse-doc <x.docx|xlsx|pdf>
parse-archive <x.zip|dir>     X 官方归档 / Takeout / Discord / Telegram / Instagram / Facebook / LinkedIn
retrospect                    纯派生 → evidence/derived/*.json（跑两次字节相同）
collect <feishu|slack|dingtalk|x|discord|reddit|notion|gmail>   要 key / OAuth
collect x --mode browser --consent <token>                      computer use（无 token → exit 2）
transcribe <audio|video>      可选后端（OpenAI 兼容 HTTP 或宿主能力）
note --from <file|->          把 LLM 自己读到的内容登记进账本（method:"model-read"）
consent <grant|list|revoke>   ~/.distilly/consent.json
view check | view render [--shareable]
doctor                        证据覆盖率 / 不可用渠道 / 锚点回指率 / computer-use 占比
skill <create|update|list|version>
install <host> | uninstall
```

迁移期兼容：旧的 `python3 tools/xxx.py` 调用由 `bin/distilly.mjs` 转发并打印 deprecation 警告（PR① 内实现，PR③ 删除）。

## 2. 磁盘契约

```
skills/<family>/<slug>/
  SKILL.md work.md persona.md work_skill.md persona_skill.md manifest.json meta.json  ← 名字与语义不变
  knowledge/{docs,messages,emails}/                                                   ← 不变
  knowledge/raw/<source>/...      # 原样字节（json/eml/mbox/html/txt/srt…），只增不改
  knowledge/text/<source>.md      # 归一化正文，段落锚点 [k0012] / [k0012:t3]
  knowledge/index.json            # 账本 {id,kind,origin,fetched_at,bytes,sha256,credentialed,method,warnings[]}
  evidence/derived/*.json         # retrospect 派生，每条结论带 evidence 锚点
  views/<slug>.view.json          # LLM 只写章节/顺序/强调（不含事实）
  views/<slug>.html               # render 产物：单文件、离线、双主题
  evidence/renders/receipt.json   # render 回执（sha256 + 字节数 + 内联来源）
```

## 3. 回执、错误与密钥

统一回执（所有命令 `--json`）：

```json
{ "command": "retrospect", "person": "zhang-san", "ok": true,
  "inputs":  [{"path": "knowledge/text/feishu.md", "sha256": "…", "bytes": 51234}],
  "outputs": [{"path": "evidence/derived/stats.json", "sha256": "…", "bytes": 4096}],
  "anchors": {"total": 812, "cited": 143},
  "warnings": ["telegram export skipped: unrelated chat"],
  "unavailable": [{"channel": "dingtalk", "reason": "no credential at ~/.distilly/dingtalk_config.json"}] }
```

- 缺输入/缺凭据 → **非零退出** + 明确补救步骤；**绝不静默降级、绝不伪造**。
- 密钥只从 `~/.distilly/*_config.json` 或环境变量读；回执/日志/错误里只出现**配置文件名**，永不出现值。
- computer-use 类命令必须带 `--consent <token>`；无 token → `exit 2` + 回执写"等待用户同意"。

## 4. 证据纪律（截图不入库）

- **截图/回执/diff 图不提交**（`.gitignore` 已含 `dst-evidence/`）。
- 每个 PR 写 `docs/evidence/pr-NN-<topic>.md`（纯文字）：变更摘要 / 测试命令与结果 / before-after 数字与图名 / 已知缺口与未验证项 / 回滚方式。
- 图存本地 `/tmp/dst-evidence/<pr>/`；由统一维护者汇总到工作区 `dst-evidence/SCREENSHOTS.md`（"指定的文档"）。
- 涉及页面/HTML 的 PR 必须给出：**0 console error、0 横向溢出**（Playwright 断言），以及**改动前后对比**（数值或像素 diff 占比）。

## 5. 测试与门禁

- 单元测试：`node --test`（零依赖）；`npm test` 汇总跑全部。
- 确定性：同一输入**跑两次 sha256 相同**（派生类命令）。
- 锚点完整性：`docs`/`views` 里引用的每个锚点必须能在 `knowledge/index.json` 回指。
- prompt 契约 lint：命令名必须真实存在、双语两段一致、锚点格式统一、禁止明文密钥字样。
- HTML 产物：内部链接 0 坏链 + axe（WCAG 2.2 A/AA）0 violations（serious/critical）。

## 6. 双语

prompt 与用户可见文档：**单文件双语**，中文段 → `---` → `## English`。
