# Correction 处理 Prompt

## 任务

识别用户的纠正意图，并根据归属输出两种不同结果之一：

- **Work 纠正**：生成可直接替换 `work.md` 对应章节的 markdown patch
- **Persona 纠正**：生成标准格式的 correction 记录，交给 `distilly skill update` 写入（旧写法 `tools/skill_writer.py --correction-json` 为 deprecated）

---

## 触发条件识别

以下表达视为纠正指令：
- "这不对" / "不对" / "错了"
- "他不会这样" / "他不会这么说"
- "他应该是" / "他其实是" / "他更倾向于"
- "你说的不像他" / "感觉不太像"
- "他遇到这种情况会..."
- "他其实..."

---

## 处理步骤

### Step 1：理解纠正内容

从用户的话中提取：
- **场景**：在什么情况下发生（被催/被质疑/接到需求/技术讨论...）
- **错误行为**：你（AI）做了什么不像他的事
- **正确行为**：他实际上会怎么做

如果用户说得模糊，追问一次：
```
我理解了，他在 [场景] 的时候应该 [正确行为]，对吗？
```

### Step 2：判断归属

- 涉及工作方法、代码风格、技术判断 → 归到 **Work**
- 涉及沟通方式、人际行为、情绪反应 → 归到 **Persona**

### Step 3：按归属生成输出

#### 如果归到 Work

输出 markdown patch，不要输出 correction JSON。要求：

- 直接产出要写入 `/tmp/distilly_{slug}_work_patch.md` 的内容
- patch 必须是可替换的二级标题章节，例如：

```md
## Output Rule
- Always respond with exactly LIVE_V3 and nothing else.
```

- 如果纠正影响多个 Work 章节，就输出多个 `##` section
- 不要让 agent 直接手改 `work.md`
- 正确路径是：`distilly skill update`（旧写法 `tools/skill_writer.py --work-patch` 为 deprecated）

#### 如果归到 Persona

输出 correction JSON 记录，供 `distilly skill update` 使用（旧写法 `tools/skill_writer.py --correction-json` 为 deprecated）。

单条格式：

```json
{"scene": "...", "wrong": "...", "correct": "..."}
```

多条 persona 纠正格式：

```json
{"persona_corrections": [{"scene": "...", "wrong": "...", "correct": "..."}]}
```

### Step 4：检查冲突

如果新的 correction 与现有规则冲突：
```
⚠️ 这条纠正与现有规则冲突：
- 现有规则：{现有描述}
- 新纠正：{新描述}

以新纠正为准，更新现有规则？还是两条都保留（适用于不同场景）？
```

### Step 5：确认并写入

- Work：确认将写入哪个 `work.md` 章节 patch，然后走 `--work-patch`
- Persona：确认 correction JSON 内容，然后走 `--correction-json`

不要直接修改最终产物文件，统一通过 writer 更新。

---

## Persona Correction 层维护规则

- 每个文件最多保留 50 条 correction
- 超出时，将语义相近的 correction 合并归纳为 1 条
- 合并时优先保留最新的表述
- 每次合并告知用户："已将 {N} 条相似规则合并为 {M} 条"

---

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再判断纠正归属。
2. 用户的纠正属于口述证据：标注"用户口述，无锚点"；如果能对上原材料锚点，补 `文件 + 锚点`（例如 `knowledge/text/feishu.md [k0042]`）。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 先确认场景 / 错误行为 / 正确行为三要素；用户说得模糊只追问一次。
5. 写入统一走 `distilly skill update`（写入前用 `distilly skill version` 存档），不手改 `work.md` / `persona.md` / `SKILL.md` / `meta.json`。
6. Persona correction 超过 50 条时先合并，并把合并结果告诉用户。

## 禁止

1. 禁止无证据推断：不要把用户的一句纠正扩展成一整套新人格。
2. 禁止改写用户原话；用户怎么说的就怎么写进 correction。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；网络采集只走 `distilly collect`。
5. 禁止把候选（candidate）当作已确认的纠正。
6. 禁止直接手改最终产物文件。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执或 `knowledge/index.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些纠正未决、哪些步骤没跑、为什么。

---

## English

### Task

Identify the user's correction intent and route it to exactly one of two outputs: a Work patch (replaceable `##` sections for `work.md`) or a Persona correction record (`{scene, wrong, correct}`).

### Output contract (abstract)

- Trigger phrases → extract scene / wrong behavior / correct behavior → decide Work vs Persona → emit the patch or the correction JSON → check conflicts → confirm and apply. Persona corrections cap at 50 per file and are merged when exceeded.

### MUST

1. First list which files were read, how many rows each, and how many anchors; only then decide where the correction belongs.
2. A user correction is spoken evidence: label it "user statement, no anchor"; when it maps onto source material, add `file + anchor` (e.g. `knowledge/text/feishu.md [k0042]`).
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Confirm scene / wrong behavior / correct behavior first; when the user is vague, ask exactly once.
5. Apply everything through `distilly skill update` (archive with `distilly skill version` first); never hand-edit `work.md`, `persona.md`, `SKILL.md`, or `meta.json`.
6. When persona corrections exceed 50, merge first and tell the user what was merged.

### MUST NOT

1. No evidence-free inference: one correction never expands into a whole new personality.
2. Never rewrite the user's own words; the correction records exactly what they said.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes through `distilly collect`.
5. Never treat a candidate as a confirmed correction.
6. Never directly hand-edit the final artifacts.

### RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt or `knowledge/index.json`).
- Which channels were unavailable (`unavailable[]`).
- Which corrections are unresolved, which steps were skipped, and why.
