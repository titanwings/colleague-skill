# dot-skill v2 · 任务与分支状态

契约：`docs/v2/CONTRACT.md`（冻结接口）· 验收：`docs/v2/ACCEPTANCE.md` · 本文件只记"谁在做什么、怎么验"。

| # | 分支 | 交付 | 依赖 | 怎么验 |
| --- | --- | --- | --- | --- |
| 1 | `ds/01-node-core` | 入口 CLI + 子命令注册骨架；`skill_{schema,presets,writer}`/`version_manager`/8 安装器移植；Unihan 拼音表；Python 测试 → `node --test`；CI 换 Node；parity 报告 | — | `npm test`；`docs/evidence/pr-01-node-core.md` 的 parity 表 |
| 2 | `ds/02-parse-zero-cred` | `knowledge/{store,ledger,anchors}` + `parse-*`（chat/email/subtitle/office/archive/feishu）+ 幂等 `harvest` | — | `npm test`；`node scripts/acceptance.mjs` 的 harvest/锚点/幂等断言 |
| 3 | `ds/03-render` | 模板碎片 + 生成物 + `--check` 防漂移；`view check/render`；`visual-check` 八项 | — | `node scripts/generate-template.mjs --check`；`node scripts/visual-check.mjs <html>` |
| 4 | `ds/04-prompts` | `SKILL.md` 五步 + 每个 prompt"必须/禁止/回执" + 三个新 prompt + `prompt-lint` | — | `node scripts/prompt-lint.mjs`；`node --test tests/prompt-contract.test.mjs` |
| 5 | `ds/05-agents` | `docs/v2/HOSTS.md` 双语文档 + INSTALL/README 宿主章节 + 断言测试（矩阵本身已由维护者落在 `src/hosts/agents.mjs`） | — | `node --test tests/agents.test.mjs`（含「矩阵 vs bin/distilly.mjs 表不漂移」断言） |
| 6 | `ds/06-retrospect` | `retrospect` → `evidence/derived/*.json`（每条带锚点、两次字节相同） | 契约（账本形状已冻结，自带合成夹具；落地后再对 ds/02 的真实输出复验） | `node --test tests/retrospect.test.mjs`；`acceptance.mjs` 的确定性/回指断言 |
| 7 | `ds/07-collect-consent` | 要 key 渠道（飞书/Slack/钉钉/X api）+ computer-use 同意门 + 密钥纪律 + transcribe 可选后端 | 契约 + `src/hosts/agents.mjs` | `node --test tests/collect.test.mjs tests/consent.test.mjs`（含"密钥不泄露"与"代码无写操作"断言） |
| 8 | `ds/08-schema-release` | `SCHEMA_VERSION 4` + 幂等迁移 + 安装器携带 `knowledge/|evidence/|views/|assets/` + 发布检查 | 1,2,3 | `node --test tests/schema-migration.test.mjs`；`scripts/check_release.mjs` |
| — | `dot-skill-test`（本分支） | 契约、验收协议、语料夹具、验收脚本、宿主矩阵 `src/hosts/agents.mjs`、本状态表 | — | `node scripts/acceptance.mjs`（依赖到位后必须全绿） |

## 合并顺序

`ds/01` → `ds/02` → {`ds/05`, `ds/06`, `ds/07`} → `ds/03`, `ds/04` → `ds/08` → 最后 `dot-skill-test` → `dot-skill`（默认分支）。
每个 PR 的 base 都是 `dot-skill-test`；合并后按 `docs/evidence/pr-NN-*.md` 复核一遍断言。
