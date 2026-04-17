# Celebrity Budget-Unfriendly Research Prompt

## Task

Run a deep, multi-dimensional celebrity research pass with maximum evidence rigor.

This mode is intentionally expensive. It should only be used when the user wants a higher-confidence skill and accepts a slower workflow.

The goal is not just to collect notes. The goal is to gather enough grounded evidence to:
- survive a later audit, synthesis pass, and validation pass
- reconstruct this person's actual cognitive operating system
- distinguish their genuine thinking patterns from generic wisdom

---

## Taste Principles

These principles govern what to collect and what to skip. They apply at every stage.

1. **Long-form > snippets**: A 3000-word essay reveals more thinking structure than 50 tweets
2. **Controversy > consensus**: Disputed positions expose distinctive thinking better than universally praised ones
3. **Change > fixity**: Where someone changed their mind is more informative than where they stayed consistent
4. **Firsthand > secondhand**: Their own words always outrank someone else's summary
5. **Craft discussion > biography**: How they talk about their process matters more than their life story
6. **Repeated patterns > one-off quotes**: A pattern that appears 5 times across contexts beats one viral line
7. **Failure discussion > success narrative**: How they talk about what went wrong reveals more than victory laps

---

## Source Quality Hierarchy

Prioritize sources in this strict order:

1. **User-provided local materials** (transcripts, PDFs, screenshots — ground truth, highest weight)
2. **First-person authored works** (books, essays, newsletters, blog posts)
3. **Long-form interviews and conversations** (podcasts 30+ min, video interviews, fireside chats)
4. **Documented decisions and turning points** (case studies, public records, reported actions with attribution)
5. **Short-form first-person content** (social media posts, short Q&A, tweet threads)
6. **External analysis and criticism** (profiles, reviews, biographies by others)
7. **Secondhand summaries** (use only to locate primary sources, never as standalone evidence)

### Source Blacklist — Permanently Excluded

**Chinese context:**
- 知乎 (Zhihu) — unverifiable anonymous answers, heavy hearsay
- 微信公众号 (WeChat official accounts) — mostly repackaged secondhand content
- 百度百科 (Baidu Baike) — unreliable, often outdated or promotional
- 搜狐/网易/腾讯 auto-generated news aggregation pages

**General:**
- Content farms and SEO-optimized summary sites
- AI-generated biography pages
- Listicles ("10 lessons from X") unless they directly quote and link primary sources
- Wikipedia as standalone evidence (acceptable only as a pointer to find real sources)
- Any source that is itself a summary of summaries

### Recommended Sources by Region

**Chinese figures:**
- B站 (Bilibili) original long-form videos and interviews
- 小宇宙 (Xiaoyuzhou) full podcast episodes
- Authoritative media: 36氪, 晚点LatePost, 财新, 极客公园, 虎嗅
- Official Weibo (verified account, direct posts — not reposts or fan accounts)
- Published books (via legitimate sources)
- 混沌学园, 湖畔大学, 得到 lecture recordings (when publicly available)

**English figures:**
- YouTube long-form interviews (Lex Fridman, Tim Ferriss, Joe Rogan, etc.)
- Personal blogs and newsletters (Substack, personal sites)
- Published books and essays
- Podcast full episodes with timestamps
- Authoritative profiles: New Yorker, Atlantic, Bloomberg, Wired, NYT, FT
- Conference talks with full video/transcript (TED, Y Combinator, etc.)

### Tooling for non-subtitled audio and video

Deep mode expects at least some of the richest dimensions (Conversations,
Expression DNA) to draw on long audio/video sources. When subtitles are missing,
use the Whisper transcription tool:

- `tools/research/transcribe_audio.py --url "<URL>" --output /tmp/x.txt`
- Local file: `--input /path/to/file.mp3 --output /tmp/x.txt`
- Model override: `--backend faster-whisper --model medium`
- Language pin (improves accuracy): `--language zh` or `--language en`

Workflow:

1. Transcribe to a temp path (never inside the skill directory).
2. Read the transcript once; extract paraphrased findings with timestamps.
3. Record only the paraphrased notes plus source metadata under
   `knowledge/research/raw/`.
4. Discard the raw transcript. The skill directory must never contain long
   verbatim transcripts — it violates copyright safety and fails the audit.

If the tool cannot be installed in the current environment, tell the user
explicitly rather than silently skipping a dimension.

---

## Parallel 6-Dimension Collection

Research MUST cover six independent dimensions. Each dimension produces its own dedicated file.
Do not merge dimensions or clone observations across files.
Do not replace these six files with one merged scratchpad.

### Dimension 1: Writings (著作与系统思考)

**File**: `01_writings.md`

**Target**: Systematic, considered positions from their own pen — where they had time to think before publishing.

Search for and document:
- Books (key arguments per chapter, not summaries)
- Essays, blog posts, newsletters
- Letters, memos, internal documents that became public
- Repeated core arguments across multiple writings
- How their written arguments evolved over time

**Extraction focus**: Core theses, reasoning chains, how they structure arguments, what they choose to write about repeatedly.

### Dimension 2: Conversations (即兴对话与压力应对)

**File**: `02_conversations.md`

**Target**: How they think on their feet — in dialogue, under pressure, when they can't prepare.

Search for and document:
- Long-form podcast appearances (30+ min, prefer full episodes)
- Video interviews with substantive back-and-forth
- Panel discussions and debates (especially where they disagree)
- AMA / Q&A sessions where audience asks unexpected questions
- How they respond to hostile or unfair questions

**Extraction focus**: Improvised reasoning, how they handle surprises, what they return to when challenged, how they disagree.

### Dimension 3: Expression DNA (语言指纹)

**File**: `03_expression_dna.md`

**Target**: Their linguistic fingerprint — the patterns that make them recognizable even without a byline.

Analyze across at least 5 different source instances:
- Sentence rhythm: average length, variation, use of fragments vs. complex sentences
- Metaphor inventory: what domains do they draw analogies from?
- Disagreement framing: direct confrontation? reframing? humor? dismissal?
- Compression level: do they explain fully or assume audience expertise?
- Certainty language: how do they express confidence vs. doubt?
- Recurring phrases, verbal tics, signature framings
- Humor style (if any): self-deprecating, absurdist, dry, combative, sarcastic
- Tone shifts: how does their voice change between casual and serious contexts?

**Extraction focus**: Style markers that pass the "blind test" — would you recognize this person from 100 words with the name removed?

### Dimension 4: Decisions (行为与选择)

**File**: `04_decisions.md`

**Target**: What they actually did, not just what they said they'd do.

Search for and document:
- Major bets: what they invested time/money/reputation in, and the reasoning
- Reversals: where they changed direction and what triggered it
- Tradeoffs: what they explicitly chose to sacrifice for what
- Failures: how they discuss what went wrong (or avoid discussing it)
- Hiring / team decisions: who they chose to work with and why
- Timing decisions: when they moved fast vs. when they waited

**Extraction focus**: Decision patterns, risk tolerance, what evidence moves them, gap between stated values and revealed preferences.

### Dimension 5: External Views (他者视角与批评)

**File**: `05_external_views.md`

**Target**: The version of this person that exists in other people's heads — especially where it diverges from their self-narrative.

Search for and document:
- Substantive criticism (not personal attacks)
- Contradictions pointed out by credible observers
- How collaborators, opponents, and successors describe them
- Known blindspots identified by domain peers
- Praise that reveals something non-obvious
- The gap between their public persona and reported private behavior

**Extraction focus**: Where the outside view diverges from the inside view. What others see that they don't.

### Dimension 6: Timeline (认知轨迹)

**File**: `06_timeline.md`

**Target**: How their thinking has evolved — not just a resume of what happened when.

Build a timeline that tracks:
- Key milestones with **cognitive impact** (how did this event change their thinking?)
- Intellectual turning points — when did a core belief shift?
- Phase transitions: were there distinct eras in their thinking?
- Recent developments (last 12–24 months)
- What they used to believe but no longer do

**Extraction focus**: The trajectory of their cognitive evolution, not a chronological biography.

---

## Cold Figure Protocol

If during research you find that multiple dimensions have very thin coverage:

1. **Do not fabricate** evidence, quotes, or attributions to fill gaps
2. **Mark each thin dimension explicitly** with what's missing and why
3. **Count total grounded sources**: if < 10, this is a cold figure
4. For cold figures:
   - Limit mental models to 2–3 maximum
   - Add "based on limited information" markers to every thin dimension
   - Expand the honest boundaries section substantially
   - Tell the user what specific additional material would improve quality
   - Consider whether to continue or recommend switching to a better-documented figure

---

## Required Output Contract

Create six raw research note files under `knowledge/research/raw/`:

- `01_writings.md`
- `02_conversations.md`
- `03_expression_dna.md`
- `04_decisions.md`
- `05_external_views.md`
- `06_timeline.md`

Each file must include:

```md
# <dimension title>

## Collection Metadata
- Dimension: [number and name]
- Collection strategy: [web-only / web+local / local-first]
- Sources searched: [count]
- Sources used: [count]
- Primary vs secondary ratio: [X:Y]

## Source Metadata
(repeat for each source)
- URL: ...
- Source type: book / essay / interview / podcast / talk / social post / article / profile / decision record
- Grounding level: primary / secondary
- Access note: public / partial / blocked
- Source weight: [1-7, per hierarchy above]
- Date: [publication or access date]

## Evidence
- ...

## Patterns and Repeated Themes
- ...

## Contradictions
- ...

## Inferences (clearly marked)
- ...

## Gaps and Missing Information
- ...
```

### Minimum Quality Floor (budget-unfriendly)

Across the full six-track set:

- at least 6 raw note files (one per dimension)
- at least 8 grounded source URLs
- at least 3 primary-source markers
- at least 6 source metadata blocks (one per file minimum)
- at least 6 contradiction bullets across the full set
- at least 6 inference bullets across the full set
- 0 potential long quote lines (copyright safety)
- track coverage count = 6 (no dimension skipped)

Grounded URLs must be actual inspected pages, not platform roots or placeholder paths.

### Keep Each Track Distinct

- Do not clone the same observations into all six files
- Each dimension has a specific extraction focus — honor it
- If a finding is relevant to multiple dimensions, put the primary evidence in the most relevant file and add a cross-reference note in the other

---

## Quality Checkpoint

After completing all six research files, before proceeding to audit, produce a structured summary:

```
┌──────────────────────────────┬──────────┬──────────┬─────────────────────────────┐
│ Dimension                    │ Sources  │ Primary% │ Key Finding                 │
├──────────────────────────────┼──────────┼──────────┼─────────────────────────────┤
│ 1 Writings                   │ N        │ XX%      │ [core thesis / gap]         │
│ 2 Conversations              │ N        │ XX%      │ [key pattern / gap]         │
│ 3 Expression DNA             │ N        │ XX%      │ [style marker / gap]        │
│ 4 Decisions                  │ N        │ XX%      │ [decision pattern / gap]    │
│ 5 External Views             │ N        │ XX%      │ [outside perspective / gap] │
│ 6 Timeline                   │ N        │ XX%      │ [trajectory / gap]          │
├──────────────────────────────┼──────────┼──────────┼─────────────────────────────┤
│ Total grounded URLs          │ N        │          │                             │
│ Primary-source markers       │ N        │          │ Target: ≥3                  │
│ Contradictions found         │ N        │          │ [summary of top 3]          │
│ Candidate mental models      │ N        │          │ [brief list]                │
│ Known-answer candidates      │ N        │          │ [questions with evidence]   │
│ Thin dimensions              │ [list]   │          │ Backfill plan: [plan]       │
│ Cold figure?                 │ yes/no   │          │                             │
└──────────────────────────────┴──────────┴──────────┴─────────────────────────────┘
```

Present this to the user and wait for confirmation before proceeding to audit.

---

## Audit Readiness

The research pass is not done when the sixth file exists. It is only done when the six-track set looks strong enough to pass a separate research audit.

Before moving on, make sure the notes support:

- at least 3 candidate mental models with cross-dimensional evidence
- at least 2 candidate known-answer questions with evidence anchors
- at least 1 credible edge-case question that would require extrapolation
- a visible contradiction inventory with at least 3 substantive tensions
- enough expression DNA samples to pass a blind style test

---

## Research Rules

- Prefer first-person material over commentary
- Prefer long-form interviews over short clips
- Prefer repeated patterns over one-off spicy quotes
- Prefer direct discussion of craft, choices, and tradeoffs over shallow biography
- Record source gaps honestly — gaps are information too
- Only record URLs you actually opened and inspected
- Generic homepages, topic pages, search pages, and placeholder media roots do not count
- Keep each track meaningfully different; each dimension has a unique extraction focus
- Build enough evidence for later known-answer and edge-case validation

## Copyright Safety

- Do not write full transcripts into the repository
- Do not paste long excerpts from books, subtitles, or articles
- Keep any direct quote very short (under 2 sentences)
- Summarize in your own words with source attribution
- Do not store subtitle dumps, transcript-like blocks, or long copied dialogue

## Output Constraint

Write in the user's language.
