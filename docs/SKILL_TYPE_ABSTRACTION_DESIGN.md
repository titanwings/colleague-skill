# Skill Type Abstraction Design

Last updated: 2026-04-16

## 1. Background

The current implementation is structurally centered on `colleague.skill`.

This is visible in several places:

- `tools/skill_writer.py` generates `name: colleague_{slug}` and uses colleague-specific descriptions
- output directories are organized under `skills/colleague/{slug}/`
- commands and docs assume `/create-colleague` is the primary entry
- metadata is optimized for a coworker profile, not a generic person/entity type

This works for v1, but it blocks the roadmap goal of evolving into `dot-skill`, where the subject can be a colleague, ex, icon, self, fictional character, or another archetype.

If we add `/create-ex` or `/create-icon` directly on top of the current structure, we will end up duplicating prompts, branching logic, gallery rules, and output formats around a model that is still fundamentally "colleague-first".

The correct next step is to abstract "skill type" into a first-class concept.

---

## 2. Design Goals

### Goals

- make the core generation pipeline support multiple skill types
- preserve backward compatibility for existing `colleague` flows
- avoid prompt and file-structure duplication for each new entry command
- provide a stable metadata contract for gallery, install, packaging, and orchestration
- keep the migration incremental, not a full rewrite

### Non-goals

- redesigning all prompts in one pass
- shipping multi-skill orchestration in this phase
- shipping multimodal assets in this phase
- replacing all user-facing commands immediately

---

## 3. Problem Statement

Today, the project mixes together three different concerns:

1. the subject being distilled
2. the creation workflow
3. the output package format

In v1, all three are implicitly "colleague".

That coupling creates four concrete problems:

### 3.1 Subject type is hardcoded

The system assumes the target is a coworker. This leaks into:

- default identity strings
- generated skill names
- directory layout
- docs and commands

### 3.2 Entry commands imply separate implementations

Without abstraction, adding `/create-ex` and `/create-icon` would likely produce:

- duplicated intake prompts
- duplicated writer logic
- type-specific conditionals scattered across tools

### 3.3 Metadata is too narrow

Current `meta.json` is enough for one generated skill directory, but not enough for:

- gallery category filtering
- installable package manifests
- type-specific rendering
- future multi-skill orchestration

### 3.4 Roadmap features have no shared contract

Future roadmap items such as:

- gallery categories
- one-click install
- active evolution
- relationship graph

all need a canonical skill identity model. That model does not exist yet.

---

## 4. Core Design

The key change is:

> move from a "colleague generator" to a "generic skill generator with type presets".

This introduces three layers:

1. `skill schema`
2. `type preset`
3. `generator pipeline`

### 4.1 Skill Schema

Every generated skill should conform to one generic metadata model.

Proposed schema:

```json
{
  "schema_version": "2",
  "id": "colleague.zhangsan",
  "slug": "zhangsan",
  "type": "colleague",
  "subtype": null,
  "display_name": "张三",
  "summary": "ByteDance L2-1 backend engineer, direct and data-driven",
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
    "tags": ["backend", "data-driven", "direct"],
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

### 4.2 Type Preset

A type preset defines how a skill type behaves without changing the core engine.

Proposed preset fields:

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

Future presets:

- `relationship`
- `icon`
- `self`
- `character`
- `meta-skill`

The critical point is that these are data/config decisions, not new pipelines.

### 4.3 Generator Pipeline

The pipeline should become:

1. resolve command to preset
2. collect input into generic schema
3. run analyzers/builders using preset bundle
4. write normalized artifacts
5. emit compatible output for old and new consumers

In short:

`command -> preset -> generic metadata -> generator -> artifacts`

not:

`command -> bespoke implementation`

---

## 5. Data Model Changes

### 5.1 Current model

Current `meta.json` is centered on a single colleague record with a `profile` block plus version fields.

That is sufficient for:

- local generation
- updates
- rollback

It is insufficient for:

- cross-type gallery browsing
- installable packaging
- orchestration
- compatibility logic across old/new commands

### 5.2 Proposed model split

Split metadata into three logical layers:

#### Layer A: Core identity

- `id`
- `slug`
- `type`
- `subtype`
- `display_name`
- `summary`

#### Layer B: Subject semantics

- `profile`
- `source_context`
- `classification`

#### Layer C: Runtime/package lifecycle

- `artifacts`
- `generation`
- `lifecycle`
- `compat`

This lets different consumers read only what they need:

- writer reads `artifacts` and `generation`
- gallery reads `classification`
- installer reads `id`, `type`, `artifacts`, `lifecycle`
- orchestration reads `type`, `source_context`, `classification`

---

## 6. File Structure Proposal

### Option A: Keep current storage root during transition

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

Pros:

- zero disruption for current commands and docs
- easier migration

Cons:

- naming remains colleague-centric

### Option B: Introduce generic root

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

Pros:

- aligns with dot-skill direction
- cleaner for install and packaging

Cons:

- larger migration blast radius
- more docs and command updates

### Recommendation

Use a two-stage migration:

1. use `skills/colleague/{slug}/` as the canonical write target for `type=colleague`
2. add internal support for a generic storage resolver
3. switch to `skills/{type}/{slug}/` only after manifest/install work starts

This reduces churn while still removing hardcoded assumptions from code.

---

## 7. Writer Refactor

`tools/skill_writer.py` should move from fixed colleague wording to schema-driven rendering.

### 7.1 Current issues

- skill frontmatter name is always `colleague_{slug}`
- descriptions are colleague-specific
- identity fallback is `同事`
- output paths are externally decided, not derived from a storage policy

### 7.2 Target writer interface

Proposed create interface:

```bash
python3 skill_writer.py \
  --action create \
  --meta meta.json \
  --work work.md \
  --persona persona.md \
  --base-dir ./skills
```

Writer behavior:

- read `type` and `generation.preset` from metadata
- resolve naming and storage via preset registry
- render frontmatter from schema, not hardcoded strings
- optionally emit legacy aliases for compatibility

### 7.3 Rendering rules

The writer should derive:

- frontmatter `name`
- human-readable description
- display heading
- identity line
- artifact filenames

from:

- metadata
- preset config

not from ad hoc string templates in code.

### 7.4 Compatibility mode

For `type=colleague`, preserve:

- `colleague_{slug}`
- existing filenames
- current rollback behavior

This keeps old generated skills runnable while the internals evolve.

---

## 8. Command Model

### 8.1 Current state

Primary entry is `/create-colleague`.

### 8.2 Proposed state

Introduce one canonical command plus aliases:

- `/create-skill` as canonical generic entry
- `/create-colleague` as alias with preset `colleague`
- future `/create-ex`, `/create-icon`, `/create-self` as aliases to type presets

### 8.3 Why alias-based commands are better

This gives us:

- one engine
- one schema
- one migration path
- multiple user-friendly entry points

without:

- multiple bespoke implementations
- repeated prompt definitions
- fragmented docs

### 8.4 Command resolution examples

| User command | Resolved preset | Output `type` |
|--------------|-----------------|---------------|
| `/create-skill` | chosen interactively or inferred | varies |
| `/create-colleague` | `colleague` | `colleague` |
| `/create-ex` | `relationship` | `relationship` |
| `/create-icon` | `icon` | `icon` |

---

## 9. Prompt Strategy

Prompt abstraction should happen in two levels.

### 9.1 Shared prompts

These can remain common:

- merger
- correction handler
- most of persona/work builders

### 9.2 Preset overlays

Different types likely need small differences in:

- intake questions
- identity framing
- allowed labels
- work section optionality
- persona extraction emphasis

So the prompt model should be:

- shared base prompt
- optional preset overlay or variables

not:

- fully duplicated prompt files per type

### 9.3 Example

A `character` preset may:

- downweight real-world source validation
- allow fictional world context
- treat "work skill" as capability set instead of job experience

A `self` preset may:

- prefer first-person self-description inputs
- allow private journals and notes as primary sources

These are preset-level differences, not engine-level rewrites.

---

## 10. Manifest and Packaging Direction

Roadmap Phase 3 mentions one-click install. That requires a package contract.

This phase should not fully implement install yet, but it should reserve the shape.

### 10.1 Proposed `manifest.json`

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

### 10.2 Why reserve it now

Because future features depend on it:

- gallery export
- download/install
- dependency checks
- multi-skill composition

If schema work ships without manifest awareness, packaging will later force another migration.

---

## 11. Collector Pluginization Alignment

This abstraction also creates a clean seam for collector plugins.

Collectors should not know about `colleague` vs `ex` vs `icon`.
They should only output normalized source material.

### 11.1 Collector contract

Collector output should be normalized into:

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

Then the generator decides:

- which preset applies
- how to interpret the material
- where it belongs in `work` vs `persona`

### 11.2 Benefit

This avoids building type-specific collectors such as:

- ex-specific iMessage collector
- icon-specific web article collector

at the interface level.

Instead, collectors become source adapters, while presets remain semantic adapters.

---

## 12. Gallery Impact

The website already wants category upgrades in Phase 2.

This design supports that cleanly:

- gallery reads `type`
- category label comes from `classification.gallery_category`
- tag filters come from `classification.tags`
- badges can depend on `source_context`

Without this abstraction, gallery categorization becomes fragile string heuristics.

---

## 13. Migration Plan

### Phase A: Metadata expansion

- add `schema_version`
- add `type`
- add `display_name`
- add `classification`
- add `generation`
- add `compat`

Keep all current fields that existing tooling expects.

### Phase B: Writer refactor

- refactor `skill_writer.py` to read generic metadata
- keep colleague-compatible output for `type=colleague`
- add tests for both legacy and generic metadata inputs

### Phase C: Command abstraction

- introduce `/create-skill`
- map `/create-colleague` to preset `colleague`
- keep old command as stable alias

### Phase D: Preset registry

- define preset registry file
- move hardcoded wording into preset config
- add first non-colleague preset, likely `self` or `icon`

### Phase E: Manifest introduction

- emit `manifest.json`
- keep it optional at first
- wire website/export tooling to consume it later

---

## 14. Backward Compatibility

Backward compatibility is mandatory for this phase.

### Must preserve

- existing `colleagues/{slug}` output for current users as a legacy fallback
- existing `meta.json` fields used by tools
- existing rollback/version behavior
- existing commands like `/create-colleague`
- existing generated `SKILL.md` shape for colleague skills

### Allowed changes

- adding new metadata fields
- internally routing through a preset registry
- adding `manifest.json`
- introducing `/create-skill` as a new canonical command

### Not allowed in this phase

- breaking old generated skill folders
- forcing all docs to rename overnight
- switching storage roots without compatibility mapping

---

## 15. Risks

### Risk 1: Over-generalization too early

If we design for every future case upfront, the schema becomes vague and bloated.

Mitigation:

- optimize for 3 to 5 concrete initial types
- prefer optional fields over deep inheritance

### Risk 2: Prompt complexity explosion

If each type gets a full prompt stack, maintenance cost will spike.

Mitigation:

- use shared prompts plus preset overlays

### Risk 3: Docs drift

Code may move to generic internals while docs still speak only in colleague terms.

Mitigation:

- keep external docs colleague-first until `/create-skill` is ready
- add an internal architecture doc before mass doc edits

### Risk 4: Website and repo schema divergence

If gallery metadata evolves separately from generated metadata, integration becomes brittle.

Mitigation:

- define one canonical schema source in this repo
- make website consume a mapped subset of it

---

## 16. Recommendation

The recommended next implementation order is:

1. define `schema_version=2` metadata contract
2. refactor `skill_writer.py` to render from metadata plus preset
3. introduce a preset registry with `colleague` first
4. add `/create-skill` as the canonical command and keep `/create-colleague` as alias
5. introduce `manifest.json`
6. add one additional preset to validate the abstraction

The first additional preset should be chosen for contrast.

Recommended order:

1. `self`
2. `icon`
3. `relationship`
4. `character`

`self` is the safest validation target because:

- input acquisition is simple
- privacy model is clearer than `relationship`
- it tests non-colleague identity without requiring source collector redesign

---

## 17. Open Questions

These should be resolved before implementation starts:

1. Should `type` reflect user-facing category (`icon`) or semantic domain (`public_figure`)?
2. Do we want one `profile` schema for all types, or a shared core plus type-specific extension blocks?
3. When can the legacy `colleagues/` fallback be removed now that canonical storage is `skills/{type}/`?
4. Should `manifest.json` be emitted immediately, or only once install flow begins?
5. Which non-colleague preset is the first real implementation target?

---

## 18. Short Version

The project should not add new create commands by cloning the current colleague flow.

It should first:

- define what a generic skill is
- make type a first-class metadata field
- move type-specific behavior into presets
- keep `/create-colleague` as a compatibility alias

That is the smallest change that unlocks:

- Phase 2 category expansion
- Phase 3 packaging/install
- future collector plugins
- future multi-skill orchestration

without turning the codebase into repeated type-specific forks.
