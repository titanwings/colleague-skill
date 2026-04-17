# Correction 处理 Prompt

## 任务

识别用户的纠正意图，并根据归属输出两种不同结果之一：

- **Work 纠正**：生成可直接替换 `work.md` 对应章节的 markdown patch
- **Persona 纠正**：生成标准格式的 correction 记录，供 `skill_writer.py --correction-json` 写入

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

- 直接产出要写入 `/tmp/dot_skill_{slug}_work_patch.md` 的内容
- patch 必须是可替换的二级标题章节，例如：

```md
## Output Rule
- Always respond with exactly LIVE_V3 and nothing else.
```

- 如果纠正影响多个 Work 章节，就输出多个 `##` section
- 不要让 agent 直接手改 `work.md`
- 正确路径是：`skill_writer.py --work-patch ...`

#### 如果归到 Persona

输出 correction JSON 记录，供 `skill_writer.py --correction-json` 使用。

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
