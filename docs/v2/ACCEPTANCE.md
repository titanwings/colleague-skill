# 验收协议：怎么证明"蒸出来的角色是想要的"

工程门禁（测试/lint/px 断言）只能证明**没编造、可复现、能渲染**，证明不了"这个人像不像"。所以效果验收单独一套，规则固定在这里，每次跑都按同一张表。

---

## 1. 留出设计（防"复述当理解"）

把语料按时间切成两段：

- **A 段（前 ~70%）**：只给蒸馏流程（`harvest → retrospect → LLM 读文件 → persona.md/work.md → view.json → render`）。
- **B 段（后 ~30%）**：只给核对者，蒸馏者与裁判都看不到。

HTML 只能由 A 段产出 —— 这样"命中"才是泛化，而不是把原文换个说法。

## 2. 三个互盲角色

| 角色 | 能看到什么 | 产出 |
| --- | --- | --- |
| 蒸馏者（本 Skill + 宿主模型） | A 段 + `knowledge/text/*` + `evidence/derived/*` | `persona.md` / `work.md` / `views/<slug>.view.json` / `views/<slug>.html` |
| 裁判（另一个模型，没参与蒸馏） | **只有 HTML**（默认私有模式：结论 + 锚点编号，无原话） | 10 条人物特征 + 每条一句**可验证的预测** |
| 核对者（第三个模型或用户本人） | 裁判的 10 条 + B 段原文 + 公开资料 | 逐条判定：命中 / 部分 / 未命中 / 无法判定 |

## 3. 评分表与目标线

命中率 = (命中 + 0.5 × 部分) ÷ 可判定条数。三条线同时看：

| 指标 | 目标 | 不达标说明什么 |
| --- | --- | --- |
| 命中率 | **≥ 7/10** | prompt 或 `retrospect` 的派生维度不够 |
| 无法判定比例 | ≤ 20% | HTML 说得太虚（"他很专业"这种），要逼出可验证表述 |
| 编造率（B 段与公开资料都找不到支持） | **0** | 立即判定 FALSIFIED，改 prompt 后重跑 |

## 4. 反向对照（证明证据层有用）

同一份 A 段跑两遍：

1. **完整流程**：`harvest → retrospect → 读文件 → render`；
2. **裸 prompt**：不让跑任何命令、不给 `evidence/derived/*`，模型自由发挥。

比较命中率与编造率。若 ② 与 ① 一样好 → 证据层是多余的，方案该砍；若 ② 编造率明显更高 → 这是最有力的一张对照表。

## 5. 机械部分（CI 可跑，`scripts/acceptance.mjs`）

流水线里能自动断言的部分，每次改动都要绿：

| 断言 | 说明 |
| --- | --- |
| 回执形状 | 每个命令 `--json` 输出含 `command/ok/inputs/outputs/warnings`，输入输出都有 sha256 与字节数 |
| 幂等 | 同一份语料重复 `harvest`，账本不重复记账、sha256 集合不变 |
| 确定性 | `retrospect`、`view render` 各跑两次，产物 sha256 相同 |
| 锚点回指 | `evidence/derived/*.json` 与 `views/*.view.json` 里引用的每个锚点都能在 `knowledge/index.json` 回指 |
| 字节守恒 | `knowledge/raw` 的总字节 ≥ `knowledge/text` 覆盖的字节，且所有丢弃都出现在 `warnings` |
| 单文件离线 | 产物无 `http(s)://` 外链、含 CSP、双击可开；`visual-check` 断言**零网络请求** |
| 视觉 | `visual-check` 八项：console 干净、八段非空、无横向溢出、双主题对比度、锚点可定位、零请求、打印不裁切、出 PNG |

跑法：

```bash
node scripts/acceptance.mjs                       # 用合成语料跑全套机械断言
node scripts/acceptance.mjs --corpus <dir>        # 换语料
node scripts/acceptance.mjs --keep                # 保留临时 person 目录以便人工看 HTML
```

语料放 `tests/fixtures/public-corpus/`（见那里的 `README.md` 与 `LICENSE.md`）。

## 6. 真实私聊/邮件语料（隐私）

不进仓库、不进 CI。流程同上，但：

- 裁判与核对者都是**用户本人**；
- 只留指标（命中率/无法判定/编造数）与结论，不留原文；
- `doctor` 的回执里如实标注"本轮使用私有语料，证据未公开"。

---

## English summary

Effect acceptance is separate from the engineering gates. Split the corpus by
time into A (70%, distillation input) and B (30%, held out for the checker).
Three mutually blind roles: distiller (produces the HTML from A), judge (sees
only the private-mode HTML, writes 10 verifiable traits), checker (sees the
traits plus B and the public record, scores hit / partial / miss / undecidable).
Targets: hit rate ≥ 7/10, undecidable ≤ 20%, fabrication **0**. Run the same A
twice — with and without the evidence layer — to prove the layer earns its keep.
Mechanical assertions (receipts, idempotence, determinism, anchor resolution,
byte conservation, single-file/offline, visual-check's eight assertions) run in
CI via `scripts/acceptance.mjs`. Private corpora follow the same table with the
user as judge and checker; only the metrics are kept.
