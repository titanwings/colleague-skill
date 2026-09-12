# Python → Node 迁移台账（Node 单栈）

目标：`tools/**/*.py` 与 `tests/test_*.py` 全部消失，运行时只依赖 Node >= 20。现状：**24 个 py 文件 / 7348 行**，测试 **10 个 / 2676 行**。

| legacy 文件 | 行数 | 归属 | 目标模块 | 状态 |
| --- | --- | --- | --- | --- |
| `tools/dingtalk_auto_collector.py` | 790 | ds/07 | `src/collect/dingtalk.mjs` | ⏳ 待开工 |
| `tools/email_parser.py` | 339 | ds/02 | `src/parse/email.mjs` | ⏳ 进行中 |
| `tools/feishu_auto_collector.py` | 960 | ds/07 | `src/collect/feishu.mjs` | ⏳ 待开工 |
| `tools/feishu_browser.py` | 374 | ds/07 | `src/collect/feishu.mjs（共享同意门）` | ⏳ 待开工 |
| `tools/feishu_mcp_client.py` | 314 | ds/07 | `src/collect/feishu.mjs（MCP 模式）` | ⏳ 待开工 |
| `tools/feishu_parser.py` | 251 | ds/02 | `src/parse/feishu.mjs` | ⏳ 进行中 |
| `tools/install_claude_generated_skill.py` | 108 | ds/01 | `src/install/hosts.mjs` | ⏳ 进行中 |
| `tools/install_codex_generated_skill.py` | 57 | ds/01 | `src/install/hosts.mjs` | ⏳ 进行中 |
| `tools/install_codex_skill.py` | 65 | ds/01 | `src/install/hosts.mjs` | ⏳ 进行中 |
| `tools/install_generated_skill.py` | 76 | ds/01 | `src/install/hosts.mjs` | ⏳ 进行中 |
| `tools/install_generated_skill_common.py` | 130 | ds/01 | `src/install/hosts.mjs` | ⏳ 进行中 |
| `tools/install_hermes_skill.py` | 65 | ds/01 | `src/install/hosts.mjs` | ⏳ 进行中 |
| `tools/install_openclaw_generated_skill.py` | 57 | ds/01 | `src/install/hosts.mjs` | ⏳ 进行中 |
| `tools/install_openclaw_skill.py` | 65 | ds/01 | `src/install/hosts.mjs` | ⏳ 进行中 |
| `tools/research/merge_research.py` | 277 | ds/02 | `src/derive/merge.mjs` | ⏳ 进行中 |
| `tools/research/quality_check.py` | 253 | ds/06 | `src/derive/quality.mjs` | ⏳ 待开工 |
| `tools/research/srt_to_transcript.py` | 92 | ds/02 | `src/parse/subtitle.mjs` | ⏳ 进行中 |
| `tools/research/transcribe_audio.py` | 304 | ds/07 | `src/optional/transcribe.mjs` | ⏳ 待开工 |
| `tools/research/xquik_public_posts.py` | 406 | ds/07 | `src/collect/x.mjs` | ⏳ 待开工 |
| `tools/skill_presets.py` | 288 | ds/01 | `src/skill/presets.mjs` | ⏳ 进行中 |
| `tools/skill_schema.py` | 411 | ds/01 | `src/skill/schema.mjs` | ⏳ 进行中 |
| `tools/skill_writer.py` | 705 | ds/01 | `src/skill/writer.mjs` | ⏳ 进行中 |
| `tools/slack_auto_collector.py` | 722 | ds/07 | `src/collect/slack.mjs` | ⏳ 待开工 |
| `tools/version_manager.py` | 239 | ds/01 | `src/skill/versions.mjs` | ⏳ 进行中 |

| legacy 测试 | 行数 | 归属 | 目标 |
| --- | --- | --- | --- |
| `tests/test_cli_lifecycle.py` | 609 | ds/01 | `tests/*.test.mjs`（`node --test`） |
| `tests/test_config_migration.py` | 53 | ds/01 | `tests/*.test.mjs`（`node --test`） |
| `tests/test_install_claude_generated_skill.py` | 98 | ds/01 | `tests/*.test.mjs`（`node --test`） |
| `tests/test_install_generated_skill.py` | 126 | ds/01 | `tests/*.test.mjs`（`node --test`） |
| `tests/test_install_hermes_skill.py` | 83 | ds/01 | `tests/*.test.mjs`（`node --test`） |
| `tests/test_install_openclaw_and_codex.py` | 140 | ds/01 | `tests/*.test.mjs`（`node --test`） |
| `tests/test_research_tools.py` | 278 | ds/01 | `tests/*.test.mjs`（`node --test`） |
| `tests/test_skill_entrypoint_docs.py` | 328 | ds/01 | `tests/*.test.mjs`（`node --test`） |
| `tests/test_skill_writer.py` | 719 | ds/01 | `tests/*.test.mjs`（`node --test`） |
| `tests/test_xquik_public_posts.py` | 242 | ds/01 | `tests/*.test.mjs`（`node --test`） |

## 规则

1. **删一个 py 文件的前提**：对应 mjs 有测试，且 parity 证据（同一输入，两边输出逐字节相同）写进 `docs/evidence/pr-NN-*.md`。
2. 纯网络/需要凭据的部分（飞书浏览器自动化、Slack/钉钉拉取）不靠"无凭据环境下的 parity"证明——用注入 mock fetch 的失败路径 + 密钥不泄露断言来证明，真实账号验证在用户授权后单独做。
3. 迁移完成判据：`find tools tests -name "*.py" | wc -l` 为 0，且 `requirements.txt` 删除，CI 只跑 Node。
