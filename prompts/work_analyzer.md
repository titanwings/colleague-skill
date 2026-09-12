# Work Skill 分析 Prompt

## 任务

你将收到 **{name}** 的原材料（文档、消息、邮件等）。
从中提取他的工作能力与方法，用于构建 Work Skill。

**原则：只提取工作相关内容，忽略闲聊。不要推断，有依据才写，没有就标注"原材料不足"。**

---

## 通用提取维度（所有职位适用）

### 1. 负责范围

从原材料中识别：
- 他负责的系统/模块/业务线/产品
- 他维护的文档（接口文档、wiki、runbook...）
- 他的职责边界（哪些是他的，哪些不是）
- 他频繁提到的项目代号、业务术语

```
输出格式：
负责领域：[描述]
核心系统：[列表]
维护文档：[列表]
边界：[他管什么/不管什么]
```

### 2. 工作流程

从任务描述、会议纪要中提取：
- 接到任务的处理步骤
- 写方案/文档的结构习惯
- 如何做进度管理和 deadline 处理
- 如何处理异常/紧急情况

```
输出格式：
接任务：[步骤]
写方案：[结构描述]
异常处理：[流程]
```

### 3. 输出格式偏好

- 用表格/列表/流程图/纯文字
- 结论前置还是娓娓道来
- 文档详细程度（极简/适中/详尽）
- 回复/邮件风格

```
输出格式：
文档风格：[描述]
详细程度：[极简/适中/详尽]
```

### 4. 经验知识库

他明确表达的经验判断、踩过的坑、技术观点（直接引用原话）：

```
- "[原话或总结]"
- "[原话或总结]"
```

---

## 职位专项提取

根据 {name} 的职位，重点提取对应维度：

---

### 🖥️ 后端工程师 / 服务端工程师

**技术规范**：
- 技术栈（语言、框架、中间件）
- 命名规范（接口路径风格、变量/函数命名）
- 接口设计（返回结构、错误码、分页、幂等）
- 数据库操作偏好（ORM vs 原生 SQL，事务边界）
- 异常处理风格

**Code Review 重点**：
- 他反复提到的 CR 问题（N+1、事务、并发安全...）
- 他的 CR 评论风格（直接/委婉，[block]/[suggest] 分级...）

**部署与运维**：
- 他关注的监控指标
- 线上问题排查步骤
- 变更发布流程

---

### 🌐 前端工程师

**技术规范**：
- 技术栈（框架、状态管理、样式方案）
- 组件拆分原则（什么时候拆，什么时候不拆）
- 性能关注点（首屏、懒加载、bundle 大小...）
- 接口调用和错误处理方式

**工程实践**：
- 代码规范工具（ESLint 规则、Prettier 配置偏好）
- 测试覆盖要求（单测/集成测试态度）
- CR 重点（可访问性/响应式/兼容性关注度）

---

### 🤖 算法工程师 / ML 工程师

**研究与实验**：
- 问题定义方式（如何拆解 ML 问题）
- 实验设计习惯（基线选择、ablation 设计）
- 指标定义偏好（离线指标 vs 在线指标的态度）
- 他常用的模型/方法论

**工程落地**：
- 训练框架偏好
- 模型上线流程
- 数据处理规范

**文档与结论**：
- 实验报告的写法（重结论/重过程）
- 他引用的 paper 或方法论

---

### 📱 产品经理 / 技术产品经理

**需求处理**：
- PRD 结构和详细程度
- 用户故事/需求边界的定义方式
- 如何与研发对齐（评审方式、修改流程）

**决策框架**：
- 优先级排序方法（RICE/MoSCoW/自定义）
- 数据驱动 vs 直觉的比例
- 如何处理需求冲突

**输出物**：
- 他交付的文档类型（PRD/MRD/原型/竞品分析）
- 原型工具偏好
- 数据埋点的参与程度

---

### 🎨 设计师

**设计规范**：
- 使用的设计系统/组件库
- 标注方式和交付规范
- 对 pixel-perfect 的要求程度

**工作流程**：
- 从需求到方案的步骤
- 走查/验收的方式
- 如何处理开发侧的还原度问题

---

### 📊 数据分析师

**分析方法**：
- 常用分析框架（漏斗/同期群/A/B 测试...）
- SQL 风格（简洁/注释详尽）
- 数据可视化偏好（图表类型选择）

**报告风格**：
- 结论 vs 数据的比例
- 对"数据说话"的执行程度
- 如何处理数据异常/口径争议

---

## 输出要求

- 语言：中文
- 没有信息的维度：标注 `（原材料不足，建议追加相关文档）`
- 有原文依据的结论：加引号标注原话
- 输出结果直接用于生成 work.md，要求具体可执行，不要写"可能""倾向于"这类模糊表述

---

## 必须

1. 先列"读了哪些文件、各多少条、多少锚点"，再写结论。
2. 每条技术结论跟 `文件 + 锚点`，例如 `knowledge/text/docs.md [k0008]`；引用原话时逐字保留。
3. 先跑 `distilly retrospect`，再读 `evidence/derived/*`；派生结论按候选处理。
4. 只提取工作相关内容，闲聊、情绪、私人话题一律不进 Work Skill。
5. 只按 {name} 的实际职位使用对应专项维度，不要把所有职位模板都套一遍。
6. 没有信息的维度写 `unknown`，并写明建议追加哪类文档。

## 禁止

1. 禁止无证据推断：职位、公司、级别不能推出技术规范。
2. 禁止改写引文；禁止把总结写成引号内的"原话"。
3. 禁止把 key 写进对话或文件；凭据只从 `~/.distilly/*_config.json` 或环境变量读取。
4. 禁止自己拼 API 请求；网络采集只走 `distilly collect`。
5. 禁止把候选（candidate）当结论。
6. 禁止用"可能使用""倾向于"这类模糊表述顶替具体规范。

## 回执

- 读过哪些文件、各多少条、多少锚点。
- 生成/更新了哪些文件，各自 sha256（来自 `distilly` 的 `--json` 回执或 `knowledge/index.json`）。
- 哪些渠道不可用（`unavailable[]`）。
- 哪些维度证据不足、哪些步骤没跑、为什么。

---

## English

### Task

Extract **{name}**'s working methods and technical standards from the imported source material so that `work_builder.md` can produce `work.md`.

Principle: work content only, ignore small talk, never infer — write only what is grounded, otherwise mark it as missing.

### Output contract (abstract)

- Responsibility scope: systems, modules, business lines, maintained documents, boundaries.
- Workflow: how they take a task, structure a design doc, manage deadlines, handle incidents.
- Output preferences: tables vs lists vs prose, conclusion-first or build-up, level of detail.
- Experience base: explicit judgments, pitfalls, technical opinions, quoted verbatim.
- Role-specific dimensions (backend / frontend / ML / PM / design / data) — only the ones matching the actual role.

### MUST

1. First list which files were read, how many rows each, and how many anchors; only then write conclusions.
2. Every technical conclusion carries `file + anchor`, e.g. `knowledge/text/docs.md [k0008]`; verbatim quotes keep their exact wording.
3. Run `distilly retrospect` first, then read `evidence/derived/*`; treat derived patterns as candidates.
4. Extract work content only; chatter, emotions, and private topics never enter the Work Skill.
5. Use only the role-specific dimension block that matches {name}'s actual role; never run every template.
6. Dimensions without information are written as `unknown`, together with the kind of document that would fill them.

### MUST NOT

1. No evidence-free inference: a job title, company, or level never implies a technical standard.
2. Never rewrite quotations, and never present your own summary as a quoted "verbatim" line.
3. Never write credentials into chat or files; they are read only from `~/.distilly/*_config.json` or environment variables.
4. Never hand-craft API calls; all network collection goes through `distilly collect`.
5. Never present a candidate as a conclusion.
6. Never let "may use" or "tends to" stand in for a concrete standard.

### RECEIPT

- Which files were read, how many rows each, how many anchors.
- Which files were created or updated, each with its sha256 (from the `distilly` `--json` receipt or `knowledge/index.json`).
- Which channels were unavailable (`unavailable[]`).
- Which dimensions are thin, which steps were skipped, and why.
