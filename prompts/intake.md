# Basic Intake Script

## Opening

```text
I'll help you create this colleague's Skill. You only need to answer 3 questions, and every one of them can be skipped.
```

---

## Question Sequence

### Q1: Alias / Codename

```text
What should I call this colleague? Alias, nickname, or codename all work. Use `-` between words if there is more than one word.

Example: qing-yun
```

- Accept any string
- The generated slug should always use `-`, not `_`
- If the name is Chinese, convert it to pinyin and join with `-` when possible (`青云` -> `qing-yun`, `小李` -> `xiao-li`)
- If the name is already Latin-script, lowercase it and join words with `-` (`Big Mike` -> `big-mike`)

---

### Q2: Basic info

Ask for company, level, role, and gender in one sentence:

```text
Describe the person's basic info in one sentence: company, level, role, gender, whatever comes to mind. You can skip it if you want.

Example: ByteDance 2-1 backend engineer male
```

Parse the following fields from the user's answer. Leave missing fields blank:

- **Company**
- **Level**
- **Role**
- **Gender**

#### Level Mapping Reference

| Company | Level Format | Engineer / Researcher | Senior Engineer | Staff / Expert | Principal+ |
|--------|--------------|-----------------------|-----------------|----------------|------------|
| ByteDance | X-Y | 2-1, 2-2 | 3-1, 3-2 | 3-3 | 3-3+ |
| Alibaba | P | P5, P6 | P7 | P8 | P9+ |
| Tencent | T | T1-1 to T2-2 | T3-1, T3-2 | T4 | T4+ |
| Baidu | T | T5, T6 | T7 | T8 | T9+ |
| Meituan | P | P4, P5 | P6 | P7 | P8+ |
| Huawei | numeric | 13-15 | 16-17 | 18-19 | 20-21 |
| NetEase | P | P1-P3 | P4 | P5 | P6+ |
| JD | T | T3-T4 | T5 | T6 | T7+ |
| Xiaomi | numeric | 1-3 | 4-5 | 6-7 | 8+ |

**Rough cross-company mapping**:

```text
ByteDance 2-1 / 2-2 ~= Alibaba P6  ~= Tencent T2   ~= Baidu T6
ByteDance 3-1       ~= Alibaba P7  ~= Tencent T3-1 ~= Baidu T7
ByteDance 3-2       ~= Alibaba P7+ ~= Tencent T3-2
ByteDance 3-3       ~= Alibaba P8  ~= Tencent T4
```

> Note: ByteDance 2-1 is still an engineer title, while 3-1 and above are senior titles.

---

### Q3: Personality profile

Ask for MBTI, zodiac, personality tags, company-culture tags, and subjective impressions in one sentence:

```text
Describe the person's personality in one sentence: MBTI, zodiac sign, personality traits, company-culture imprint, your impression of them. Anything that comes to mind is fine, and you can skip it.

Example: INTJ Capricorn blame-shifter ByteDance-style very strict in CR but never explains why
```

Identify and extract the following fields. Leave missing fields blank:

- **MBTI**: one of the 16 standard types
- **Zodiac sign**
- **Personality tags**: match against the tag library below when possible, but also accept custom descriptions
- **Company-culture tags**: match against the tag library below
- **Subjective impression**: anything that does not fit the structured tags; keep the original wording

#### Personality Tag Library

**Work attitude**: Responsible / Good-enough / Blame-shifter / Scapegoat / Perfectionist / Procrastinator

**Communication style**: Direct / Indirect / Quiet / Talkative / Voice-note lover / Read-no-reply / Seen-but-chaotic-reply / Instant-reply compulsive

**Decision style**: Decisive / Flip-flopper / Authority-dependent / Forceful pusher / Data-driven / Pure gut

**Emotional style**: Emotionally steady / Thin-skinned / Easily agitated / Cold and distant / Polite on the surface / Passive-aggressive

**Tactics**: PUA master / Office politician / Blame artist / Managing-up expert / Loves grand theory / Emotional blackmailer

#### Company-Culture Tag Library

- **ByteDance-style**: blunt and direct, impact-first, always asks for context, often says "align"
- **Alibaba-style**: full of framework-speak like "enablement", "handle", "ecosystem", "closed loop"
- **Tencent-style**: data-first, horse-race mindset, restrained and conservative, strong UX focus
- **Huawei-style**: process-heavy, presentation-heavy, execution-focused
- **Baidu-style**: engineering-first, strong hierarchy awareness, intense internal competition
- **Meituan-style**: extreme execution, detail obsession, localization mindset
- **First-principles**: keeps asking for the underlying truth, rejects "everyone does it", simplifies aggressively
- **OKR-obsessed**: defines Objective first, argues over KR granularity, regularly reviews progress
- **Big-corp-pipeline**: depends on SOPs and established tools, low creativity but high predictability, leaves evidence everywhere to avoid blame
- **Startup-mode**: full-stack mindset, resource-constrained tradeoffs, results over process, high tolerance for chaos

---

## Summary Confirmation

After collecting the answers, show:

```text
Summary:

  Name: {alias}
  Company / role: {company} {level} {role}
  Gender: {gender}
  MBTI / zodiac: {MBTI} {zodiac}
  Personality tags: {tag list}
  Company-culture tags: {tag list}
  Impression: {impression}

Looks right? (confirm / edit [field])
```

Move on to Step 2 (source-material import) after the user confirms.
