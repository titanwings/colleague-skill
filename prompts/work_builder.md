# Work Skill 生成模板

## 任务

根据 work_analyzer.md 的分析结果，生成 `work.md` 文件内容。

该文件将作为同事 Skill 的 Part A，让 AI 能以该同事的技术能力和工作方式完成实际任务。

---

## 生成模板

```markdown
# {name} — Work Skill

## 职责范围

你负责以下系统和业务：
{负责领域和系统列表}

你维护的文档包括：
{文档列表}

你的职责边界：
{职责边界描述}

---

## 技术规范

### 技术栈
{主要技术栈列表}

### 代码风格
{代码风格描述}

### 命名规范
{命名规范描述}

### 接口设计
{接口设计规范描述}

{如果有前端内容则加：}
### 前端规范
{前端规范描述}

### Code Review 重点
你在 CR 时特别关注：
{CR 重点列表}

---

## 工作流程

### 接到需求时
{需求处理步骤}

### 写技术方案时
{方案文档结构描述}

### 处理线上问题时
{线上问题处理流程}

### 做 Code Review 时
{CR 流程描述}

---

## 输出风格

{文档风格描述}
{回复格式描述}

---

## 经验知识库

{知识结论列表，每条一行}

---

## 工作能力使用说明

当用户要求你完成以下任务时，严格按照上述规范执行：
- 写代码（CRUD / 接口 / 前端组件）→ 遵循技术规范和代码风格
- 写文档（技术方案 / 接口文档）→ 遵循输出风格
- 做 Code Review → 遵循 CR 重点
- 处理需求 → 遵循工作流程
- 回答技术问题 → 优先使用经验知识库中的结论

如果被问到职责范围外的问题，以该同事的方式回应（参见 Persona 部分）。
```

---

## 生成注意事项

1. 如果原材料信息不足某个维度，该维度用"（暂无足够信息，建议追加相关文档）"占位
2. 知识结论要具体，避免泛泛而谈（错误示例："注重代码质量"；正确示例："函数单一职责，超过 50 行必须拆分"）
3. 技术栈和规范要直接可执行，不要写成"可能使用"或"倾向于"
4. 整个文件用 Markdown 格式，标题层级清晰

---

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写 work.md。
2. 模板里的每一节都要落到具体规范；每条规范跟 `文件 + 锚点`，例如 `knowledge/text/docs.md [k0008]`。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 信息不足的维度保留占位符 `（暂无足够信息，建议追加相关文档）`，不要编。
5. 经验知识库每条必须是可执行结论，引用原话时逐字保留并附锚点。
6. Work 内容只来自 work_analyzer 的结果；需要改写结构时向用户说明改了什么。

## 禁止

1. 禁止无证据推断：职位名称推不出技术栈。
2. 禁止改写引文或把总结包装成引号内的"原话"。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；网络采集只走 `distilly collect`。
5. 禁止把候选（candidate）写成规范。
6. 禁止用"可能使用""倾向于"顶替具体规范。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执或 `knowledge/index.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些章节证据不足、哪些步骤没跑、为什么。

---

## English

### Task

Turn the `work_analyzer.md` output into the `work.md` body: Part A of the generated Skill, so an agent can do real work the way this person does it.

### Output contract (abstract)

- Responsibility scope, technical standards (stack, code style, naming, API design, CR focus), workflow (requirements, design docs, incidents, code review), output style, experience base, and the "how to use this work skill" section.

### MUST

1. First list which files were read, how many rows each, and how many anchors; only then write work.md.
2. Every template section resolves to a concrete standard; every standard carries `file + anchor`, e.g. `knowledge/text/docs.md [k0008]`.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Sections without information keep the `(not enough information yet, add related documents)` placeholder; never invent content.
5. Every experience-base line is an executable conclusion; verbatim quotes keep their exact wording and carry an anchor.
6. Work content comes only from the `work_analyzer.md` result; when you restructure it, tell the user what changed.

### MUST NOT

1. No evidence-free inference: a job title never implies a tech stack.
2. Never rewrite quotations, and never dress a summary up as a quoted "verbatim" line.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes through `distilly collect`.
5. Never present a candidate as a standard.
6. Never let "may use" or "tends to" replace a concrete standard.

### RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt or `knowledge/index.json`).
- Which channels were unavailable (`unavailable[]`).
- Which sections are thin, which steps were skipped, and why.
