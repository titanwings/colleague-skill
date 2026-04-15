# Work Skill Analysis Prompt

## Task

You will receive source material about **{name}** (documents, messages, emails, etc.).
Extract the person's working capability and methods so they can be turned into a `Work Skill`.

**Principle:** only extract work-related content. Ignore casual chatter. Do not infer unsupported conclusions. If something is not backed by the source material, mark it as insufficient.

---

## General Extraction Dimensions

### 1. Scope of responsibility

Identify from the material:

- Systems / modules / business lines / products they own
- Documents they maintain (API docs, wiki pages, runbooks, etc.)
- Their ownership boundary (what they do vs. what they do not own)
- Project codenames and business terms they mention frequently

```text
Output format:
Areas of responsibility: [description]
Core systems: [list]
Maintained docs: [list]
Boundary: [what they own / what they do not own]
```

### 2. Workflow

Extract from task descriptions and meeting notes:

- Their step-by-step process when receiving a task
- How they structure plans or documents
- How they manage progress and deadlines
- How they handle incidents or urgent situations

```text
Output format:
When receiving a task: [steps]
When writing a proposal: [structure]
Incident handling: [process]
```

### 3. Output preferences

- Table / list / flowchart / plain text
- Lead with the conclusion or build up slowly
- Document detail level (minimal / moderate / detailed)
- Reply or email style

```text
Output format:
Document style: [description]
Detail level: [minimal / moderate / detailed]
```

### 4. Experience knowledge base

Capture explicit experience-based judgments, pitfalls, and technical opinions, ideally as direct quotes:

```text
- "[quote or concise summary]"
- "[quote or concise summary]"
```

---

## Role-Specific Extraction

Focus on the dimensions that match {name}'s role:

---

### Backend / Server Engineer

**Technical standards**

- Tech stack (language, framework, middleware)
- Naming standards (API path style, variable / function naming)
- API design (response shape, error codes, pagination, idempotency)
- Database preferences (ORM vs raw SQL, transaction boundaries)
- Exception-handling style

**Code review focus**

- Recurring CR concerns (N+1, transactions, concurrency safety, etc.)
- CR tone (direct / polite / `[block]` vs `[suggest]` severity, etc.)

**Deployment and operations**

- Monitoring metrics they care about
- Online-issue debugging steps
- Release process

---

### Frontend Engineer

**Technical standards**

- Tech stack (framework, state management, styling strategy)
- Component-splitting principles
- Performance concerns (first paint, lazy-loading, bundle size, etc.)
- API-calling and error-handling patterns

**Engineering practice**

- Code quality tools (ESLint / Prettier preferences)
- Testing expectations (unit vs integration attitude)
- CR focus (accessibility / responsive behavior / compatibility)

---

### ML / Algorithm Engineer

**Research and experiments**

- How they define and break down ML problems
- Experiment design habits (baselines, ablations)
- Metric preferences (offline vs online)
- Models or methods they rely on frequently

**Productionization**

- Preferred training frameworks
- Model launch process
- Data-processing standards

**Documentation and conclusions**

- Style of experiment reports (conclusion-first vs process-heavy)
- Papers or frameworks they cite repeatedly

---

### Product Manager / Technical Product Manager

**Requirement handling**

- PRD structure and detail level
- How they define user stories and scope boundaries
- How they align with engineering (review style, revision loop)

**Decision framework**

- Prioritization method (RICE / MoSCoW / custom)
- Balance of data vs intuition
- How they handle requirement conflicts

**Deliverables**

- Types of artifacts they produce (PRD / MRD / prototype / competitor analysis)
- Prototype tool preferences
- Involvement in analytics / event tracking

---

### Designer

**Design standards**

- Design system or component library usage
- Annotation and handoff conventions
- Pixel-perfect strictness

**Workflow**

- Steps from requirement to design proposal
- Review and acceptance habits
- How they deal with implementation fidelity gaps

---

### Data Analyst

**Analysis methods**

- Common frameworks (funnels / cohorts / A/B tests, etc.)
- SQL style (minimal vs heavily commented)
- Visualization preferences (chart selection)

**Reporting style**

- Balance of conclusions vs raw data
- How hard they push "let the data speak"
- How they handle anomalous data or metric-definition disputes

---

## Output Requirements

- Output language: match the user's current language in the active flow
- If a dimension lacks evidence, mark it as `(insufficient source material; suggest adding more relevant docs)`
- If a conclusion is directly backed by a quote, include the quote
- The output will feed directly into `work.md`, so keep it concrete and actionable. Avoid vague wording like "might", "probably", or "tends to"
