# 基础信息录入脚本

## 开场白

```
我来帮你创建这位同事的 Skill。只需要回答 3 个问题，每个都可以跳过。
```

---

## 问题序列

### Q1：花名/代号

```
这位同事怎么称呼？（花名、昵称或代号都行，多个字用 - 连接）

例：qing-yun
```

- 接受任意字符串
- 生成的 slug 统一用 `-` 连接（不用下划线）
- 中文自动转拼音再用 `-` 连接（"青云" → `qing-yun`，"小李" → `xiao-li`）
- 英文直接小写 `-` 连接（"Big Mike" → `big-mike`）

---

### Q2：基本信息

把公司、职级、职位、性别放在一个问题里，让用户一句话说完：

```
用一句话描述他的基本信息——公司、职级、职位、性别，想到什么写什么，跳过也行。

例：字节 2-1 后端工程师 男
```

从用户的回答中解析以下字段（缺失的留空）：
- **公司**
- **职级**
- **职位**
- **性别**

#### 职级对照参考表

| 公司 | 职级格式 | 工程师/研究员 | 高级工程师 | 资深/专家 | Staff/Principal |
|------|---------|------------|---------|---------|----------------|
| 字节跳动 | X-Y | 2-1, 2-2 | 3-1, 3-2 | 3-3 | 3-3+（O级） |
| 阿里巴巴 | P级 | P5, P6 | P7 | P8 | P9+ |
| 腾讯 | T级 | T1-1~T2-2 | T3-1, T3-2 | T4 | T4+ |
| 百度 | T级 | T5, T6 | T7 | T8 | T9+ |
| 美团 | P级 | P4, P5 | P6 | P7 | P8+ |
| 华为 | 数字级 | 13-15 | 16-17 | 18-19 | 20-21 |
| 网易 | P级 | P1-P3 | P4 | P5 | P6+ |
| 京东 | T级 | T3-T4 | T5 | T6 | T7+ |
| 小米 | 数字级 | 1-3 | 4-5 | 6-7 | 8+ |

**跨公司粗略对应**：

```
字节 2-1/2-2  ≈  阿里 P6   ≈  腾讯 T2  ≈  百度 T6
字节 3-1      ≈  阿里 P7   ≈  腾讯 T3-1 ≈  百度 T7
字节 3-2      ≈  阿里 P7+  ≈  腾讯 T3-2
字节 3-3      ≈  阿里 P8   ≈  腾讯 T4
```

> 注：字节 2-1 是工程师职称，3-1 起为高级工程师；
> 2-1 约等于阿里 P6，是独立完成任务的主力工程师级别。

---

### Q3：性格画像

把 MBTI、星座、个性标签、企业文化标签、主观印象全部合在一起，让用户自由描述：

```
用一句话描述他的性格——MBTI、星座、个性特点、企业文化烙印、你对他的印象，
想到什么写什么，跳过也行。

例：INTJ 摩羯座 甩锅高手 字节范 CR很严格但从来不解释原因
```

从用户的回答中识别并提取以下字段（缺失的留空）：
- **MBTI**：16 种标准类型
- **星座**：12 星座
- **个性标签**：从下方标签库匹配，也接受自定义描述
- **企业文化标签**：从下方标签库匹配
- **主观印象**：无法归类的自由描述，直接保留原文

#### 个性标签库

**工作态度**：认真负责 / 差不多就行 / 甩锅高手 / 背锅侠 / 完美主义 / 拖延症

**沟通风格**：直接 / 绕弯子 / 话少 / 话多 / 爱发语音 / 只读不回 / 已读乱回 / 秒回强迫症

**决策风格**：果断 / 反复横跳 / 依赖上级 / 强势推进 / 数据驱动 / 全凭感觉

**情绪风格**：情绪稳定 / 玻璃心 / 容易激动 / 冷漠疏离 / 表面和气 / 阴阳怪气

**话术与手段**：PUA 高手 / 职场政治玩家 / 甩锅艺术家 / 向上管理专家 / 爱讲大道理 / 情绪勒索

#### 企业文化标签库

- **字节范** — 坦诚直接、追求 impact、开口必讲 context、爱说"对齐"
- **阿里味** — 六脉神剑、爱用"赋能""抓手""生态""闭环"
- **腾讯味** — 数据说话、赛马机制、克制保守、注重用户体验
- **华为味** — 奋斗者文化、流程规范、爱做 PPT 汇报、强调执行力
- **百度味** — 技术至上、层级意识强、内部竞争激烈
- **美团味** — 极致执行、抠细节、本地化思维
- **第一性原理** — 马斯克式，追问本质、拒绝类比、激进简化
- **OKR 狂热者** — 凡事先问 Objective、对 KR 斤斤计较
- **大厂流水线** — 规范完善但创造力低、依赖 SOP、怕背锅
- **创业公司派** — 资源有限、全栈思维、结果导向、容忍混乱

---

## 确认汇总

收集完毕后展示：

```
信息汇总：

  👤  {花名}
  🏢  {公司} {职级} {职位}（若未填则省略）
  ⚧   {性别}（若未填则省略）
  🧠  {MBTI} {星座}（若未填则省略）
  🏷️   个性：{标签列表}（若未填则省略）
  🏢  企业文化：{标签列表}（若未填则省略）
  💬  印象：{印象文本}（若未填则省略）

确认无误？（确认 / 修改 [字段名]）
```

用户确认后进入 Step 2 文件导入。

---

## 必须

1. 先把用户的原话按字段拆开列出来，再问下一题；不要替用户补字段。
2. 缺失字段留空并显式写 `unknown`，不得根据公司/职级推断性别、MBTI、性格。
3. 汇总确认里每个字段都要能指回用户的原话；用户说"跳过"就真的留空。
4. `celebrity` 的第 4 个问题必须确认 `research_profile`（默认 `budget-friendly`），不得默认跳过。
5. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；intake 阶段不引用派生结论。
6. 确认前不得开始采集；确认后进入 Collect（`distilly harvest` / `distilly collect`）。

## 禁止

1. 禁止无证据推断：用户没说的性格、职级、公司一律不写。
2. 禁止改写用户原话（尤其是主观印象字段，必须原样保留）。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；需要凭据的渠道只走 `distilly collect`。
5. 禁止把候选（candidate）标签当作用户确认过的信息。
6. 禁止一次抛出多个问题；一次只问一个。

## 回执

- 读过哪些文件、各多少条、多少锚点（intake 阶段通常为 0，如实写 0）。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执或 `knowledge/index.json`）；intake 不写文件时写"无"。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些字段没问到、哪些步骤没跑、为什么。

---

## English

### Task

Collect the minimum manual profile for a new Skill: 3 questions for `colleague` and `relationship`, 4 for `celebrity` (the fourth confirms `research_profile`). Everything except the alias may be skipped.

### Output contract (abstract)

- Q1 alias/codename → slug (lowercase, hyphen-joined), Q2 one-line basic info (company, level, role, gender), Q3 one-line personality profile (MBTI, zodiac, tags, culture, impression) parsed into fixed field lists, plus a confirmation summary before collection starts.

### MUST

1. List the user's own words split by field before asking the next question; never fill a field for them.
2. Missing fields stay empty and are explicitly `unknown`; never infer gender, MBTI, or personality from company or level.
3. Every field in the summary must trace back to the user's own words; when the user says "skip", it really stays empty.
4. For `celebrity`, the fourth question must confirm `research_profile` (default `budget-friendly`); never skip it silently.
5. Run `distilly retrospect` first, then read `evidence/derived/*`; intake itself never cites derived conclusions.
6. Do not start collection before confirmation; after confirmation move to Collect (`distilly harvest` / `distilly collect`).

### MUST NOT

1. No evidence-free inference: personality, level, or company that the user never stated is never written down.
2. Never rewrite the user's own words, especially the free-form impression field, which stays verbatim.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; channels that need credentials go through `distilly collect`.
5. Never treat a candidate tag as information the user confirmed.
6. Never ask several questions at once; ask one at a time.

### RECEIPT

- Which files were read, how many rows each, how many anchors (usually 0 during intake — say 0 honestly).
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt or `knowledge/index.json`); write "none" when intake writes no file.
- Which channels were unavailable (`unavailable[]`).
- Which fields were never asked, which steps were skipped, and why.
