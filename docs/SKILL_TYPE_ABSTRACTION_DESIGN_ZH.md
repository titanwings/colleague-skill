# Skill 类型抽象设计

最后更新：2026-04-16

## 1. 背景

当前项目的核心实现，本质上还是围绕 `colleague.skill` 展开的。

这个假设已经渗透进多个层面：

- `tools/skill_writer.py` 默认生成 `name: colleague_{slug}`
- 输出目录默认是 `skills/colleague/{slug}/`
- 文档和命令默认入口是 `/create-colleague`
- `meta.json` 的语义更接近“同事档案”，而不是通用 skill 元数据

这套设计对 v1 没问题，但它会直接卡住 roadmap 里从 `colleague.skill` 演进到 `dot-skill` 的目标。

因为 roadmap 的下一阶段已经不只是“把同事蒸馏成 skill”，而是：

- 同事
- 前任 / 旧友 / 关系对象
- 偶像 / 公众人物 / 历史人物
- 自己
- 虚构角色

如果在现有结构上直接去加 `/create-ex`、`/create-icon`，结果很可能是：

- 再复制一套 intake prompt
- 再复制一套 writer 逻辑
- 到处出现 `if type == xxx`
- gallery、manifest、安装流程各自再做一遍类型分叉

这种做法短期能跑，长期一定会让代码和文档越来越难维护。

所以在真正开始做 Phase 2 之前，应该先做一层“类型抽象”。

---

## 2. 设计目标

### 目标

- 让核心生成流程支持多种 skill 类型
- 保持现有 `colleague` 工作流兼容，不打断已有用户
- 避免为每一种新入口复制一套 prompt、writer 和目录结构
- 为 gallery 分类、manifest、安装、组合编排提供统一元数据基础
- 采用渐进式迁移，而不是一次性大改

### 非目标

- 这一轮不重写全部 prompts
- 这一轮不实现 multi-skill orchestration
- 这一轮不实现 multimodal 资产体系
- 这一轮不强制把所有用户入口都改成 `/create-skill`

---

## 3. 当前问题是什么

目前系统把三件本来应该分开的事情，耦合在了一起：

1. 被蒸馏的对象是谁
2. 创建流程怎么走
3. 产物文件长什么样

在 v1 里，这三件事默认都等于“同事”。

这会带来四个直接问题。

### 3.1 对象类型被写死了

当前实现默认目标对象一定是“同事”。

这个假设体现在：

- 默认身份文案
- 生成的 skill 名称
- 输出目录命名
- 文档术语和命令名称

### 3.2 新入口会诱导出多套实现

如果不先抽象，后续一旦加：

- `/create-ex`
- `/create-icon`
- `/create-self`

最自然但最糟糕的演进方式就是：

- 每个命令各自维护 intake
- 每个命令各自处理 metadata
- 每个命令各自组装最终的 SKILL.md

这样很快就会变成多套平行实现。

### 3.3 元数据模型太窄

现在的 `meta.json` 足够支持：

- 本地生成
- 增量更新
- 回滚

但不够支持：

- gallery 分类和过滤
- install / package
- 类型化展示
- 未来多 skill 编排

### 3.4 roadmap 后续能力没有共同底座

roadmap 里后面这些目标：

- 分类升级
- 一键安装
- 持续进化
- 关系图谱

都需要一个稳定的“skill 身份模型”。

现在这个模型还不存在。

---

## 4. 核心思路

核心思路一句话：

> 不再把项目理解成“同事生成器”，而是“通用 skill 生成引擎 + 类型 preset”。

也就是把系统拆成三层：

1. `skill schema`
2. `type preset`
3. `generator pipeline`

### 4.1 Skill Schema

每个生成出来的 skill，都应该符合一套统一的元数据结构，而不是只服务于同事场景。

建议的 schema 方向如下：

```json
{
  "schema_version": "2",
  "id": "colleague.zhangsan",
  "slug": "zhangsan",
  "type": "colleague",
  "subtype": null,
  "display_name": "张三",
  "summary": "字节 L2-1 后端工程师，直接、数据驱动",
  "profile": {
    "name": "张三",
    "company": "ByteDance",
    "level": "L2-1",
    "role": "Backend Engineer",
    "gender": "male",
    "mbti": "INTJ"
  },
  "source_context": {
    "domain": "work",
    "relationship_to_user": "coworker",
    "is_real_person": true,
    "is_public_figure": false,
    "is_fictional": false
  },
  "classification": {
    "gallery_category": "Colleague",
    "tags": ["backend", "direct", "data-driven"],
    "language": "zh-CN"
  },
  "artifacts": {
    "combined_skill": "SKILL.md",
    "work_skill": "work_skill.md",
    "persona_skill": "persona_skill.md",
    "work_doc": "work.md",
    "persona_doc": "persona.md"
  },
  "generation": {
    "preset": "colleague",
    "prompt_bundle": "v1-colleague",
    "created_from": ["feishu", "manual_tags"],
    "corrections_count": 0
  },
  "lifecycle": {
    "status": "active",
    "version": "v1",
    "created_at": "2026-04-16T00:00:00Z",
    "updated_at": "2026-04-16T00:00:00Z"
  },
  "compat": {
    "legacy_command": "/create-colleague",
    "legacy_storage_root": "colleagues"
  }
}
```

这个结构的重点不是字段多少，而是要把以下概念分开：

- skill 是什么
- 这个 skill 属于什么类型
- 它有哪些产物
- 它怎么生成的
- 它如何兼容旧系统

### 4.2 Type Preset

类型 preset 的作用是：

在不改生成引擎的前提下，告诉系统“这一类对象应该怎么被创建、怎么被描述、怎么被展示”。

可以理解成：

- `colleague` 是一个 preset
- `self` 是一个 preset
- `icon` 是一个 preset
- `relationship` 是一个 preset
- `character` 是一个 preset

建议 preset 里至少包含这些信息：

```json
{
  "name": "colleague",
  "display_name": "Colleague",
  "source_domain": "work",
  "relationship_to_user": "coworker",
  "identity_label": "同事",
  "gallery_category": "Colleague",
  "command_aliases": ["/create-colleague", "/create-skill"],
  "prompt_bundle": {
    "intake": "prompts/intake.md",
    "work_analyzer": "prompts/work_analyzer.md",
    "persona_analyzer": "prompts/persona_analyzer.md",
    "work_builder": "prompts/work_builder.md",
    "persona_builder": "prompts/persona_builder.md",
    "merger": "prompts/merger.md",
    "correction_handler": "prompts/correction_handler.md"
  },
  "writer": {
    "skill_name_prefix": "colleague",
    "storage_root": "skills/colleague"
  }
}
```

重点是：

后续新增类型时，优先是“新增 preset”，而不是“复制一整套实现”。

### 4.3 Generator Pipeline

未来生成流程应该是：

1. 用户命令解析到某个 preset
2. 输入信息被写入统一 schema
3. 按 preset 选择 prompt bundle / overlay
4. 通用 generator 产出 `work.md` / `persona.md` / `SKILL.md`
5. writer 根据 metadata + preset 渲染最终产物

也就是：

`command -> preset -> schema -> generator -> artifacts`

而不是：

`command -> 专属实现`

---

## 5. 数据模型怎么改

### 5.1 当前模型的问题

现在的 `meta.json` 更像是：

- 一个“同事档案”
- 加上一点版本信息

它不是面向系统协作的通用元数据。

因此当前模型适合：

- writer
- rollback
- update

但不适合：

- gallery
- package / install
- future relationship graph
- multi-skill composition

### 5.2 建议拆成三层

建议把 metadata 分成三个逻辑层。

#### A. 核心身份层

- `id`
- `slug`
- `type`
- `subtype`
- `display_name`
- `summary`

#### B. 语义信息层

- `profile`
- `source_context`
- `classification`

#### C. 运行 / 生命周期层

- `artifacts`
- `generation`
- `lifecycle`
- `compat`

这样不同模块就能只读自己需要的部分：

- writer 主要读 `artifacts`、`generation`
- gallery 主要读 `classification`
- installer 主要读 `id`、`type`、`artifacts`
- orchestration 主要读 `type`、`source_context`

---

## 6. 文件结构怎么演进

### 方案 A：迁移期保留当前目录

```text
skills/colleague/{slug}/
  SKILL.md
  work.md
  persona.md
  work_skill.md
  persona_skill.md
  meta.json
  versions/
```

优点：

- 和当前系统完全兼容
- 迁移风险最低

缺点：

- 命名仍然偏“同事”

### 方案 B：切到通用目录

```text
skills/{type}/{slug}/
  SKILL.md
  work.md
  persona.md
  work_skill.md
  persona_skill.md
  meta.json
  manifest.json
  versions/
```

优点：

- 和 dot-skill 方向一致
- 对 install / package / 分类更自然

缺点：

- 改动面更大
- 现有命令、文档、脚本都要适配

### 建议

采用两阶段迁移：

1. 把 `skills/colleague/{slug}` 作为 `type=colleague` 的规范输出目录，同时保留 `colleagues/{slug}` 的历史兼容
2. 代码内部先抽象出 `storage resolver`
3. 等 manifest / install 设计稳定后，再考虑统一切换到 `skills/{type}/{slug}`

这样改动最稳，不会一上来把 blast radius 扩太大。

---

## 7. `skill_writer.py` 应该怎么改

当前 [`tools/skill_writer.py`](/Users/zhoutianyi/project/colleague-skill-series/colleague-skill/tools/skill_writer.py) 最大的问题不是“代码写得不好”，而是它承担了太多写死的 colleague 语义。

### 7.1 现状中的硬编码

- frontmatter 名称默认 `colleague_{slug}`
- 描述文案默认是“某某的工作能力 / 人物性格”
- 身份 fallback 默认是“同事”
- 输出结构默认围绕 `skills/colleague/`

### 7.2 目标接口

writer 应该从“写死文案的文件写入器”，变成“基于 schema + preset 的产物渲染器”。

理想调用方式类似：

```bash
python3 skill_writer.py \
  --action create \
  --meta meta.json \
  --work work.md \
  --persona persona.md \
  --base-dir ./skills
```

writer 的职责应该变成：

- 读取 metadata
- 读取 preset 配置
- 决定命名规则和路径
- 渲染 frontmatter、identity、description
- 写出兼容的 artifacts

而不是自己决定“你一定是同事，所以名称前缀一定是 colleague”。

### 7.3 兼容要求

对 `type=colleague`，这一轮必须保持：

- `colleague_{slug}`
- 当前文件名
- 当前 rollback 行为
- 当前组合 skill 的整体结构

也就是说：

内部抽象可以变化，对外产物尽量不破。

---

## 8. 命令模型怎么设计

### 8.1 当前状态

当前核心入口是 `/create-colleague`。

### 8.2 目标状态

建议引入：

- `/create-skill` 作为通用主入口
- `/create-colleague` 作为 `colleague` preset 的兼容别名
- 后续 `/create-ex`、`/create-icon`、`/create-self` 也都是 preset alias

### 8.3 这样做的好处

这样可以实现：

- 一个生成引擎
- 一套 metadata
- 一套 writer
- 多个用户友好入口

而不是：

- 多套命令
- 多套 prompt
- 多套模板
- 多套文档解释

### 8.4 例子

| 用户命令 | 解析结果 | 输出 type |
|----------|----------|-----------|
| `/create-skill` | 用户选择或系统推断 preset | 取决于 preset |
| `/create-colleague` | `colleague` preset | `colleague` |
| `/create-ex` | `relationship` preset | `relationship` |
| `/create-icon` | `icon` preset | `icon` |

---

## 9. Prompt 应该怎么抽象

这里不建议为每个类型复制全套 prompt。

更合理的做法是“两层结构”。

### 9.1 共用基础 prompt

这些内容大概率可以共用：

- merger
- correction handler
- work/persona builder 主体结构

### 9.2 类型 overlay

不同类型真正不同的地方主要在：

- intake 提问方式
- 身份 framing
- 标签范围
- work 部分是不是必需
- persona 提取重点

因此应该优先设计成：

- 一个 base prompt
- 一层 preset overlay 或变量注入

而不是：

- 每个类型一整套完全独立 prompt 文件

### 9.3 示例

比如：

- `character` 类型可以弱化真实世界数据校验，更强调“世界观”和“角色能力”
- `self` 类型可以允许第一人称自述、日记、个人笔记作为高权重来源
- `icon` 类型可以把公开采访、演讲、文章作为主要输入源

这些都应该是 preset 差异，而不是引擎分叉。

---

## 10. 为 manifest / package 预留空间

roadmap 第三阶段里有“一键安装”，这件事一定需要一个 package contract。

这一轮不需要立刻把 install 做完，但必须先把结构想清楚，不然后面又要返工。

### 10.1 建议引入 `manifest.json`

比如：

```json
{
  "manifest_version": "1",
  "id": "colleague.zhangsan",
  "type": "colleague",
  "display_name": "张三",
  "entrypoints": {
    "default": "SKILL.md",
    "work": "work_skill.md",
    "persona": "persona_skill.md"
  },
  "artifacts": [
    "SKILL.md",
    "work.md",
    "persona.md",
    "meta.json"
  ],
  "capabilities": ["persona", "work"],
  "install": {
    "compatible_runtimes": ["claude-code"],
    "min_schema_version": "2"
  }
}
```

### 10.2 为什么现在就要预留

因为后面这些能力都要依赖它：

- gallery export
- download / install
- compatibility check
- future multi-skill composition

如果 schema 升级时完全不考虑 manifest，后面大概率又会有第二次迁移。

---

## 11. 和 collector 插件化的关系

这个抽象设计其实也正好给 collector 插件化提供了边界。

collector 不应该知道“这是同事、前任、偶像还是角色”。

collector 应该只负责做一件事：

> 把外部来源转换成标准化的原始材料。

### 11.1 collector 的理想输出

例如：

```json
{
  "source_type": "feishu_messages",
  "subject_candidates": ["张三"],
  "documents": [],
  "messages": [],
  "attachments": [],
  "metadata": {
    "collected_at": "2026-04-16T00:00:00Z"
  }
}
```

之后再由 generator / preset 去决定：

- 这份材料对应哪个类型
- work 和 persona 怎么切
- 最终写到哪里

### 11.2 这样做的好处

这样可以避免未来出现：

- ex 专属 iMessage collector
- icon 专属文章 collector
- self 专属日记 collector

这种“来源逻辑”和“语义逻辑”耦合的设计。

正确做法应该是：

- collector 是 source adapter
- preset 是 semantic adapter

---

## 12. 对网站 gallery 的影响

website 在 roadmap 里已经明确要做 category upgrade。

如果主仓库先有统一 schema，这件事会很好做：

- gallery 直接读 `type`
- 分类标签直接读 `classification.gallery_category`
- filters 直接读 `classification.tags`
- 特殊徽章可以读 `source_context`

否则网站侧最后只能靠字符串规则猜：

- 名字里有没有某种词
- 描述像不像某类对象
- YAML 手填一些和主仓库脱节的字段

这会让主仓库和网站的模型越来越分裂。

---

## 13. 迁移计划

建议按下面顺序推进。

### Phase A：先扩 `meta.json`

先加：

- `schema_version`
- `type`
- `display_name`
- `classification`
- `generation`
- `compat`

同时保留所有旧字段，避免现有脚本直接挂掉。

### Phase B：重构 `skill_writer.py`

- 让 writer 从 metadata + preset 渲染产物
- 对 `type=colleague` 保持当前输出不变
- 补 legacy / generic 两种输入的测试

### Phase C：引入命令抽象

- 增加 `/create-skill`
- 把 `/create-colleague` 变成 `colleague preset` 的 alias
- 旧命令继续可用

### Phase D：引入 preset registry

- 定义 preset 注册表
- 把写死文案从代码挪到 preset 配置
- 先只落地 `colleague`
- 再加第一个非 colleague preset 验证抽象是否成立

### Phase E：引入 `manifest.json`

- writer 可选输出 `manifest.json`
- 先不强制所有下游依赖它
- 后续网站和 install 再逐步接入

---

## 14. 向后兼容要求

这一轮是架构升级，不是破坏式重构。

### 必须保持的东西

- 当前 `colleagues/{slug}` 输出结构仍然可作为历史兼容路径
- 现有 `meta.json` 被依赖的字段继续存在
- rollback / version 逻辑不破
- `/create-colleague` 不下线
- 已经生成好的 colleague skills 继续能跑

### 可以新增的东西

- 新 metadata 字段
- preset registry
- `/create-skill`
- `manifest.json`

### 这一轮不能做的事

- 直接打破旧目录结构
- 一夜之间把所有文档术语全改掉
- 强制所有老用户迁移

---

## 15. 风险

### 风险 1：过度泛化

如果一开始就想把所有未来类型都设计完整，schema 会很快膨胀得过头。

应对方式：

- 先围绕 3 到 5 种具体类型建模
- 多用可选字段，少做复杂继承体系

### 风险 2：prompt 维护成本爆炸

如果每个类型都复制一整套 prompt，维护成本会快速失控。

应对方式：

- 共享基础 prompt
- 只在 preset 层做增量 overlay

### 风险 3：代码和文档脱节

内部已经变成通用引擎，但外部文档还全部只说 colleague，容易让贡献者理解混乱。

应对方式：

- 在 `/create-skill` 真正上线前，外部文档仍然保持 colleague-first
- 先补内部架构文档，再逐步调整外部文档

### 风险 4：主仓库和网站模型分叉

如果 website 自己定义一套 category schema，主仓库自己定义一套 skill schema，后面同步会很痛苦。

应对方式：

- 先在主仓库定义 canonical schema
- 网站只消费它的一个映射子集

---

## 16. 推荐的落地顺序

建议按这个顺序实施：

1. 定义 `schema_version=2` 的 metadata 契约
2. 重构 `skill_writer.py`，让它吃 metadata + preset
3. 引入 preset registry，先只支持 `colleague`
4. 增加 `/create-skill`，但保留 `/create-colleague` 兼容别名
5. 引入 `manifest.json`
6. 增加第一个非 colleague preset 验证抽象

第一个非 colleague preset，我建议优先做：

1. `self`
2. `icon`
3. `relationship`
4. `character`

为什么 `self` 最适合最先做：

- 输入来源最简单
- 不需要先解决复杂关系伦理问题
- 不依赖新的外部 collector
- 足够验证“不是同事也能走同一引擎”

---

## 17. 需要尽快拍板的问题

正式开始实现前，建议先决定下面 5 个问题：

1. `type` 应该用用户能理解的类别名，还是更底层的语义域名？
2. `profile` 是全类型共用一套结构，还是共用核心字段 + 类型扩展字段？
3. 既然规范目录已经是 `skills/{type}/`，历史 `colleagues/` 兼容什么时候移除？
4. `manifest.json` 是现在就产出，还是等 install 流程开始时再产出？
5. 第一个非 colleague preset 选哪个？

---

## 18. 一句话总结

Phase 2 真正该先做的，不是多加几个 `/create-xxx` 命令。

而是先把这件事定义清楚：

> 一个通用 skill 到底是什么，它的类型怎么表达，它的元数据怎么组织，它的生成流程怎么复用。

只要这层抽象做好了，后面的：

- `/create-skill`
- 分类升级
- collector 插件化
- manifest / install
- multi-skill collaboration

都会顺很多。

如果这层不先做，后面每加一个类型，仓库里就会多一套复制粘贴出来的流程，最后反而把 roadmap 自己卡死。
