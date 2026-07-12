# Claude Code E2E Prompt

Use the prompt below in Claude Code to run a serious end-to-end evaluation of AI Interior Atelier against the new Phase 2 priorities.

---

You are acting as an end-to-end product evaluator for `AI Interior Atelier`, not just a bug checker.

Your job is to run a real, phased evaluation of the application from the point of view of the owner using the local repo and app. You must evaluate:

1. workflow clarity
2. UI/UX quality
3. design-brain quality
4. render preservation quality
5. spatial/design judgment
6. overall product coherence

You are not allowed to stop at "the route returned 200" or "the UI loaded." This evaluation must judge whether the product feels like a premium AI interior design studio rather than an AI pipeline.

## Repo context

- Repo: `C:\Users\darre\Documents\AI Interior Designer`
- Planning source: `docs/PHASE2_PLAN_2026-07-08.md`
- Product context: `PROJECT_BRAIN.md`
- Existing build history and verification context: `BUILD_PLAN.md`

Read those files first before testing.

## Evaluation mode

Run this as a phased E2E review with explicit success/fail gates.

For each phase:
- perform the work
- capture what happened
- judge against the gate
- mark the phase `PASS`, `SOFT FAIL`, or `HARD FAIL`
- explain why

Use screenshots where useful.
Use the real app flow, not just direct API pokes, unless a direct check is needed to confirm a bug.

## Required phases

### Phase 0: Setup and context

Tasks:
- read `docs/PHASE2_PLAN_2026-07-08.md`
- read `PROJECT_BRAIN.md`
- read `BUILD_PLAN.md`
- inspect the current room workflow and visible navigation
- summarize the intended product direction in 5-10 lines before testing

Gate:
- `PASS` if you clearly understand the intended concept-first, render-first direction
- `HARD FAIL` if you cannot establish the intended workflow or cannot locate the key planning docs

### Phase 1: Entry flow and information architecture

Tasks:
- evaluate dashboard, home creation, room creation, and initial room entry
- judge whether the room workflow is intuitive
- determine whether the product currently feels diagnosis-first, concept-first, render-first, or tool-tab-first
- note friction in labels, hierarchy, and next-step guidance

Gate:
- `PASS` if the flow feels obvious and homeowner-friendly
- `SOFT FAIL` if the flow works but feels confusing, overly technical, or out of order
- `HARD FAIL` if the user cannot reasonably infer what to do next

### Phase 2: Concepts and direction approval

Tasks:
- enter a realistic room brief with dimensions, purpose, and style intent
- generate concepts
- review concept names, rationale, palette/material direction, and approval UX
- judge whether the concepts feel like the work of an experienced designer or generic AI styling
- judge whether approving a direction feels decisive and premium

Gate:
- `PASS` if concepts feel distinct, defensible, and high-taste, and approval feels clear
- `SOFT FAIL` if concepts technically work but feel generic, repetitive, or poorly presented
- `HARD FAIL` if concepts are low-quality, confusing, or structurally unusable

### Phase 3: Render execution and preservation

Tasks:
- approve a direction
- render the concept over a real room photo
- inspect architectural preservation:
  - doors
  - windows
  - trim
  - ceiling
  - floor plane
  - camera angle
  - lighting realism
- inspect design judgment:
  - no blocked doors
  - no broken circulation
  - no implausible furniture placement
  - no warped or duplicated objects
- judge whether the render feels premium and believable

Gate:
- `PASS` if the render preserves the real room and makes design decisions that feel plausible and mature
- `SOFT FAIL` if preservation is strong but the design judgment or styling quality is weak
- `HARD FAIL` if the render breaks architecture, circulation, or core room logic

### Phase 4: Chat revision experience

Tasks:
- use chat to request a realistic revision
- judge whether chat feels like collaborating with a designer or issuing commands to a tool
- inspect whether the system keeps context about approved direction and current render
- inspect whether revision guidance is clear and actionable

Gate:
- `PASS` if the revision flow feels coherent, contextual, and premium
- `SOFT FAIL` if it works mechanically but feels shallow or disconnected
- `HARD FAIL` if it confuses state, loses context, or cannot guide revision well

### Phase 5: Products as downstream support

Tasks:
- inspect when and how products appear in the journey
- judge whether products feel supportive of an approved direction or distract from the core render loop
- inspect whether product sourcing quality, naming, and rationale feel credible

Gate:
- `PASS` if products feel like optional execution support after the design is proven
- `SOFT FAIL` if products work but are over-emphasized or feel like a separate AI stage
- `HARD FAIL` if product flow actively degrades the core experience

### Phase 6: UI/UX and visual design review

Tasks:
- evaluate typography, spacing, card hierarchy, color system, action hierarchy, and screen composition
- specifically judge whether the app feels:
  - premium
  - calm
  - editorial
  - mature
  - expert-led
- specifically call out any areas that feel:
  - student-project-like
  - admin-panel-like
  - default SaaS-like
  - visually noisy
  - poorly prioritized

Gate:
- `PASS` if the interface feels like a premium design product
- `SOFT FAIL` if the interface is functional but not visually mature
- `HARD FAIL` if the interface materially undermines trust or quality perception

### Phase 7: Final judgment

Tasks:
- produce a final verdict on whether the product currently feels like:
  - a design intelligence system
  - a promising prototype
  - a technically strong but aesthetically weak tool
  - an AI pipeline with UI around it
- identify the top 5 issues by severity
- identify the top 3 highest-leverage fixes
- separate:
  - workflow problems
  - UI/UX problems
  - design-brain problems
  - render-judgment problems

Gate:
- `PASS` only if the product feels coherent, premium, and owner-trustworthy across the full loop
- otherwise fail honestly

## Evaluation rules

- Do not be polite at the expense of accuracy.
- Do not confuse successful API calls with product success.
- Do not give a passing result if the visual or design judgment still feels weak.
- Prefer direct, concrete criticism over vague encouragement.
- Use exact examples from the run.
- Name the specific screen, state, or artifact that caused each issue.

## Output format

Return your final report in this exact structure:

### 1. Executive verdict
- one paragraph

### 2. Phase results
- Phase 0: PASS / SOFT FAIL / HARD FAIL
- Phase 1: ...
- Phase 2: ...
- Phase 3: ...
- Phase 4: ...
- Phase 5: ...
- Phase 6: ...
- Phase 7: ...

### 3. Top findings
- ordered by severity
- include concrete evidence

### 4. What is already strong
- only include genuinely strong areas

### 5. What most undermines trust
- focus on the biggest perception problems

### 6. Highest-leverage next moves
- 3 items maximum

### 7. Final classification
Choose exactly one:
- `Premium and coherent`
- `Promising but uneven`
- `Technically impressive, product-wise weak`
- `Not ready for owner trust`

## Success/fail interpretation

Use these definitions consistently:

- `PASS` = works and feels right
- `SOFT FAIL` = works, but the experience or quality is not good enough
- `HARD FAIL` = broken, misleading, or fundamentally off-strategy

If the render preservation is excellent but the taste and layout judgment are weak, that is not a full pass.

If the UI is functional but feels amateur, that is not a full pass.

If the workflow completes but feels backwards, that is not a full pass.

Your standard should be: does this feel like the product of a seasoned interior designer using excellent software, or not?

---
