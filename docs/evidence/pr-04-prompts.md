# PR-04 · 提示词层（`ds/04-prompts`）证据

纯文字 PR，无 HTML 产物、无截图（`/tmp/dst-evidence/` 无文件）。命令名一律以 `docs/v2/CONTRACT.md` §1 的命令块为准。

---

## 1. 变更摘要

| 类别 | 内容 |
|------|------|
| 重写 | `SKILL.md`：主线改为五步 **Collect → Derive → Read → Distill → Render**，每步给出"必须存在的产物 / 计数判据 / sha256 来源 / 失败怎么办"；新增命令契约表（逐字取自 CONTRACT §1）与 `python3 tools/*.py` → `distilly` 迁移表（旧写法全部标 `deprecated`）；保留触发条件、intake、celebrity research 门槛、进化模式（追加/纠正）、管理操作；文末补 必须/禁止/回执 |
| 追加三段 | 7 个核心 prompt（`intake`、`persona_analyzer`、`persona_builder`、`work_analyzer`、`work_builder`、`merger`、`correction_handler`）各加中文 `必须/禁止/回执` + 英文段 `## English`（任务摘要 + `MUST/MUST NOT/RECEIPT`） |
| 最小改动 | 15 个 family prompt（`prompts/celebrity/**` 11 个、`prompts/relationship/**` 4 个）：命令引用对齐契约 + 中文摘要与三段 + 英文 `MUST/MUST NOT/RECEIPT`；英文正文保持不变 |
| 新增 prompt | `prompts/collectors.md`、`prompts/retrospection.md`、`prompts/computer-use.md`（各自双语 + 三段） |
| 新增文档 | `docs/v2/PROMPTS.md`：提示词层契约与 lint 规则，以及给 ds/05、ds/06 的接口 |
| 新增工具 | `scripts/prompt-lint.mjs`（零依赖） |
| 新增测试 | `tests/prompt-contract.test.mjs`（`node --test`，1 正例 + 3 反例 + CLI 退出码 + 契约缺失） |

规模：`SKILL.md` 1518 → 687 行；`prompts/**/*.md` 22 → 25 个文件。PR diff：30 个文件（6 个新增提示词/工具/测试 + 1 个新增文档 + 本证据文件 + 22 个 prompt 与 `SKILL.md` 修改）。

---

## 2. lint 与测试输出

```bash
$ node scripts/prompt-lint.mjs
prompt-lint: 0 finding(s) in 0 file(s) across 26 file(s) scanned (contract commands: 16)
$ echo $?
0

$ node --test
# tests 5
# pass 5
# fail 0

$ node --test tests/prompt-contract.test.mjs
ok 1 - the contract command block is the single source of truth
ok 2 - the repository tree lints clean (positive case)
ok 3 - negative fixtures: the three contract violations are caught
ok 4 - the CLI exits non-zero and prints file:line for every finding
ok 5 - the CLI fails loudly when the contract is missing
```

lint 解析出的命令集合（16 个，直接来自 `CONTRACT.md` §1）：

```
collect consent doctor harvest install note parse-archive parse-chat
parse-doc parse-email parse-subtitle retrospect skill transcribe uninstall view
```

反例输出（测试用临时目录构造，`node scripts/prompt-lint.mjs --root <tmp>`）：

```
prompts/bad-command.md:5 command unknown command `distilly frobnicate`; not in docs/v2/CONTRACT.md §1 (...)
prompts/missing-mustnot.md:13 sections missing Chinese `## 禁止` section
prompts/missing-mustnot.md:13 sections missing English `## MUST NOT` section
prompts/half-command.md:17 bilingual command `distilly retrospect` appears only in the Chinese half
prompt-lint: 5 finding(s) in 3 file(s) across 4 file(s) scanned (contract commands: 16)
```

---

## 3. before-after（同一份 lint，前后各跑一次）

before 树 = 本分支起点 `05ff594`（`git archive 05ff594 | tar -x -C /tmp/before`），after 树 = 本分支 HEAD。

| | before | after |
|---|---|---|
| 扫描文件 | 23（`SKILL.md` + 22 prompts） | 26（`SKILL.md` + 25 prompts） |
| 结论条数 | **257** | **0** |
| `sections`（缺 必须/禁止/回执） | 138 | 0 |
| `deprecated`（旧 `tools/*.py` 未标注） | 94 | 0 |
| `bilingual`（无 `## English` / 两段命令不一致） | 23 | 0 |
| `forbidden`（明文凭据） | 2（`SKILL.md:207`、`SKILL.md:960` 的 `app_secret` 字面量示例） | 0 |
| `command`（不存在的子命令） | 0（旧文档只写 `python3 tools/*.py`，未使用 `distilly`） | 0 |
| `anchor`（锚点格式不合规） | 0（旧文档没有锚点） | 0 |

复现命令：

```bash
cd <repo> && git archive 05ff594 | tar -x -C /tmp/before
node scripts/prompt-lint.mjs --root /tmp/before    # 257 findings, exit 1
node scripts/prompt-lint.mjs                       # 0 findings, exit 0
```

> 说明：`sections` 在 before 树里对每个 prompt 报中英各 3 条（缺 6 段），因为旧 prompt 既没有三段也没有英文段；`deprecated` 命中的都是 `SKILL.md` 里未标注的 `python3 tools/*.py` 教学段落。after 树两类都清零。

---

## 4. 已知缺口与未验证项

1. **命令尚未落地**：本分支的 `bin/distilly.mjs` 仍只实现 `install` / `--version` / `--help` / `--check-package`；`harvest / parse-* / retrospect / collect / transcribe / note / consent / view / doctor / skill` 由 ds/01、ds/02、ds/03、ds/06、ds/07 交付。prompt 层按**冻结契约**写命令名，lint 也只校验"命令名 ∈ CONTRACT §1"，**没有**校验"命令在二进制里真的存在"。契约落地后建议补一条集成断言（prompt 命令集 ⊆ CLI 帮助里的命令集）。
2. **无 `npm test` 脚本**：`package.json` 不在本任务文件范围（归 ds/01）。本 PR 的验证命令是 `node scripts/prompt-lint.mjs` 与 `node --test`（`node --test` 在仓库根已能发现本测试）。
3. **未整篇互译**：7 个核心 prompt 以中文正文为准，英文段是任务摘要 + 三段；15 个 family prompt 以英文正文为准，中文段是任务摘要 + 三段。**整篇逐段互译是已知缺口**（`docs/v2/PROMPTS.md` §3 已记录）。
4. **契约未定义的 flag 一律不写**：`skill version` 的备份/回滚参数、`collect` 的 MCP 子模式 flag、`consent grant` 如何签发 `--consent` token、computer-use 截图与屏数在回执里的字段名，契约表都只给了子命令名；prompt 里只描述行为要求，不发明 flag/字段。
5. **xquik 映射**：`tools/research/xquik_public_posts.py` → `distilly collect x`，与 `docs/v2/MIGRATION.md`（`src/collect/x.mjs`，ds/07）一致；若 ds/07 最终暴露成别的子命令，需同步 3 处 prompt（`SKILL.md`、`prompts/celebrity/research.md`、`prompts/celebrity/budget_unfriendly/research.md`）。
6. **`download_subtitles.sh`**：迁移台账里没有对应目标模块，prompt 只保留"让用户给本地字幕 → `distilly parse-subtitle`"，未发明下载命令。
7. **lint 精度取舍**（已在 `docs/v2/PROMPTS.md` §5 记录）：`sk-` 只在密钥形状（`sk-proj-` 等已知前缀，或 `sk-` + 20 位以上字母数字）时报错，避免 `task-oriented` 误报；Python HTTP 库只在 `import requests` / `requests.get(` 这类代码用法时报错，普通英文散文不算违规。
8. **lint 不扫 docs/**：`README.md`、`INSTALL*.md`、`docs/*.md` 里仍有 `python3 tools/*.py` 旧写法（不在本任务文件范围），迁移完成时需要另行清理（MIGRATION.md 规则 3 已覆盖）。
9. **未在真实宿主里跑过**：本 PR 只改提示词与门禁，未在 Claude Code / Codex / DSH 里实跑五步主线；真实采集（飞书/钉钉/X）需要凭据，属于 ds/07 的验证范围。

---

## 5. 回滚

- 整个 PR：`git revert --no-edit <merge-commit>`；分支是纯增量（新增 7 个文件 + 重写 `SKILL.md` 与 22 个 prompt），revert 后工作区回到 `dot-skill-test` 当前状态，无数据迁移、无产物需要清理。
- 单点回滚：
  - 提示词层 → `git checkout <base> -- SKILL.md prompts/`
  - 门禁 → `git rm scripts/prompt-lint.mjs tests/prompt-contract.test.mjs docs/v2/PROMPTS.md`（其余环节不依赖它们）
- 回滚后自检：`node scripts/prompt-lint.mjs --root <回滚后的树>` 会重新报出 257 条，属预期（提示词层回到契约前状态）。
