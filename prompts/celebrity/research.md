# Celebrity Research Prompt (Budget-Friendly)

## Task

Run a structured, multi-dimensional research pass on a public figure before distillation.

The goal is not to collect trivia or compile a biography.
The goal is to extract enough grounded evidence to reconstruct:

- mental models (how they think)
- decision heuristics (how they choose)
- expression DNA (how they speak)
- anti-patterns (what they reject)
- honest boundaries (where evidence runs out)

---

## Taste Principles

These principles govern what to collect and what to skip:

1. **Long-form > snippets**: A 3000-word essay reveals more thinking structure than 50 tweets
2. **Controversy > consensus**: Disputed positions expose distinctive thinking better than universally praised ones
3. **Change > fixity**: Where someone changed their mind is more informative than where they stayed consistent
4. **Firsthand > secondhand**: Their own words always outrank someone else's summary
5. **Craft discussion > biography**: How they talk about their process matters more than their life story
6. **Repeated patterns > one-off quotes**: A pattern that appears 5 times across contexts beats one viral line

---

## Source Quality Hierarchy

Prioritize sources in this order:

1. **User-provided local materials** (transcripts, PDFs, screenshots — ground truth)
2. **First-person authored works** (books, essays, newsletters, blog posts)
3. **Long-form interviews and conversations** (podcasts, 30+ min interviews, fireside chats)
4. **Documented decisions and turning points** (case studies, public records, reported actions)
5. **Short-form first-person content** (social media posts, short Q&A, tweets/threads)
6. **External analysis and criticism** (profiles, reviews, biographies by others)
7. **Secondhand summaries** (use only when nothing else is available)

### Source Blacklist

These sources are permanently excluded — never cite them as evidence:

**Chinese context:**
- 知乎 (Zhihu) — unverifiable anonymous answers, heavy hearsay
- 微信公众号 (WeChat official accounts) — mostly repackaged secondhand content
- 百度百科 (Baidu Baike) — unreliable, often outdated or promotional

**General:**
- Content farms and SEO-optimized summary sites
- AI-generated biography pages
- Listicles ("10 lessons from X") unless they quote primary sources with links
- Wikipedia as a primary source (acceptable only as a pointer to find real sources)

### Recommended Sources by Region

**Chinese figures:**
- B站 (Bilibili) original videos, especially long interviews
- 小宇宙 (Xiaoyuzhou) podcasts
- Authoritative media: 36氪, 晚点LatePost, 财新, 极客公园, 虎嗅
- Official Weibo (verified account, direct posts only)
- Published books (via legitimate sources)

**English figures:**
- YouTube long-form interviews (Lex Fridman, Tim Ferriss, etc.)
- Personal blogs and newsletters
- Published books and essays
- Podcast full episodes (not clips)
- Authoritative profiles: New Yorker, Atlantic, Bloomberg, Wired

### Tooling for non-subtitled content

Long interviews and podcasts without subtitles are often the richest source of
Expression DNA and on-the-fly reasoning — do not skip them. Use:

- `tools/research/transcribe_audio.py --url "<video/podcast URL>" --output /tmp/x.txt`

This runs Whisper (faster-whisper / openai-whisper / OpenAI API) against the
audio track. Read the transcript once, extract paraphrased findings with
timestamps, then discard it. **Never commit the full transcript into the skill
directory** — only short paraphrased notes with source metadata belong under
`knowledge/research/raw/`.

---

## Parallel 6-Dimension Collection Strategy

Research must cover six dimensions. Think of each dimension as an independent investigation track.
Do not write one monolithic note. Each dimension produces its own research file.
Do not collapse the whole pass into one monolithic note.

### Dimension 1: Writings (著作与文字)

**Target**: Systematic, considered positions from their own pen.

Search for:
- Books, chapters, or key passages (by title and argument, not full text)
- Essays, blog posts, newsletters
- Letters, memos, internal documents that became public
- Repeated core arguments that appear across multiple writings

**What to extract**: Core theses, reasoning chains, how they build an argument.

### Dimension 2: Conversations (对话与访谈)

**Target**: How they think on their feet, under pressure, in dialogue.

Search for:
- Long-form podcast appearances (30+ minutes)
- Video interviews with substantive Q&A
- Panel discussions and debates
- AMA / Q&A sessions

**What to extract**: How they handle unexpected questions, how they disagree, what they return to repeatedly.

### Dimension 3: Expression DNA (表达风格)

**Target**: Linguistic fingerprint — not what they say, but how they say it.

Analyze across multiple sources:
- Sentence rhythm and average length
- Metaphor frequency and preferred analogies
- How they frame disagreement (direct? diplomatic? sarcastic?)
- Compression level (do they explain fully or assume the audience keeps up?)
- Recurring phrases, verbal tics, signature framings
- Humor style (if any): self-deprecating, absurdist, dry, combative

**What to extract**: Style markers that could pass a "100-word blind test" — could you recognize this person from a paragraph with the name removed?

### Dimension 4: Decisions (关键决策)

**Target**: What they actually did, not just what they said.

Search for:
- Major bets and why they made them
- Reversals — where they changed direction and what triggered it
- Tradeoffs they explicitly chose (what they sacrificed for what)
- Failures they've discussed openly
- What they optimized for vs. what they deliberately ignored

**What to extract**: Decision patterns, risk tolerance, what kind of evidence moves them.

### Dimension 5: External Views (他者视角)

**Target**: How others see them — especially the gaps between self-image and outside image.

Search for:
- Criticism and negative assessments (not just praise)
- Contradictions others have pointed out
- How collaborators, opponents, and successors describe them
- Known blindspots identified by others

**What to extract**: The version of this person that exists in other people's heads, especially where it diverges from their self-narrative.

### Dimension 6: Timeline (时间线与变化)

**Target**: How their thinking has evolved, not just what happened when.

Build:
- Key milestones with cognitive impact (not just biographical events)
- Intellectual turning points — when did a core belief change?
- Recent developments (last 12–24 months) that might affect current thinking
- Phase transitions: were there distinct eras in their public thinking?

**What to extract**: The trajectory of their thinking, not a resume.

---

## Cold Figure Protocol

If during research you find that a dimension has very thin coverage:

1. **Do not fabricate** evidence, quotes, or attributions to fill the gap
2. **Mark the dimension explicitly** as thin with a note on what's missing
3. **Reduce expectations**: If total grounded sources < 10, this is a cold figure
4. For cold figures:
   - Limit mental models to 2–3 maximum
   - Mark thin models as "based on limited information"
   - Expand the honest boundaries section
   - Tell the user what additional material would improve the Skill

---

## Required Output Contract

Create at least three raw note files under `knowledge/research/raw/`:

- `01_core_profile.md` — Dimensions 1 + 6 (writings + timeline)
- `02_conversations_and_material.md` — Dimensions 2 + 4 (conversations + decisions)
- `03_expression_and_reception.md` — Dimensions 3 + 5 (expression DNA + external views)

Each file must use this structure:

```md
# <track title>

## Dimension Coverage
- Dimensions covered: [list]
- Collection strategy used: [web-only / web+local / local-first]

## Source Metadata
- URL: ...
- Source type: interview / book / essay / talk / podcast / social post / article / profile
- Grounding level: primary / secondary
- Access note: public / partial / blocked
- Source weight: [1-7, per hierarchy above]

## Key Findings
- ...

## Patterns and Repeated Themes
- ...

## Contradictions
- ...

## Inferences (clearly marked as inference, not fact)
- ...

## Gaps and Missing Information
- ...
```

### Minimum Quality Floor

Across the full note set:

- at least 3 raw note files
- at least 2 grounded source URLs (actual inspected pages, not homepages)
- clearly separated evidence vs inference in every file
- at least 1 contradiction identified (or explicit note that none were found)
- at least 1 gap acknowledged

### URL Grounding Rules

These do **not** count as grounded sources:

- Platform homepages (youtube.com, weibo.com, bilibili.com)
- Search result pages (/search, /s?)
- Topic or tag pages (/topic/, /tag/)
- Profile roots without specific content
- Placeholder paths (v.qq.com/detail/)
- Any URL you did not actually open and read

---

## Quality Checkpoint

After completing the research pass, before proceeding to analysis, produce a structured quality summary:

```
┌──────────────────────────────┬──────────┬─────────────────────────────┐
│ Dimension                    │ Sources  │ Key Finding                 │
├──────────────────────────────┼──────────┼─────────────────────────────┤
│ 1 Writings                   │ N        │ [core thesis / gap]         │
│ 2 Conversations              │ N        │ [key pattern / gap]         │
│ 3 Expression DNA             │ N        │ [style marker / gap]        │
│ 4 Decisions                  │ N        │ [decision pattern / gap]    │
│ 5 External Views             │ N        │ [outside perspective / gap] │
│ 6 Timeline                   │ N        │ [trajectory / gap]          │
├──────────────────────────────┼──────────┼─────────────────────────────┤
│ Contradictions found         │ N        │ [summary]                   │
│ Thin dimensions              │ [list]   │ Mitigation: [plan]          │
│ Cold figure?                 │ yes/no   │                             │
└──────────────────────────────┴──────────┴─────────────────────────────┘
```

Present this to the user and wait for confirmation before proceeding to analysis.
If the user identifies issues or wants more depth on a dimension, extend the research.

---

## Output Rules

- Distinguish clearly between:
  - what they said (primary, quoted or paraphrased)
  - what they did (documented actions)
  - what others said about them (external, attributed)
  - what you infer (marked as inference)
- Keep contradictions — they are features, not bugs
- Prefer depth over breadth
- Write in the user's language
- Never invent sources, URLs, quotes, or bibliographic details
- Never use generic homepages or platform roots as fake grounding
- Only record URLs you actually opened and inspected
- If verified external sources are unavailable, say so explicitly
- Do not store full transcripts or large subtitle dumps in the skill directory
- Keep any direct quote short and sparse
- Prefer paraphrased notes with source metadata over copied passages

## Copyright Safety

- No full transcripts stored
- No long passage quotes from books, subtitles, interviews
- Paraphrased notes + source metadata only
- Short quote snippets only when essential for capturing expression DNA
