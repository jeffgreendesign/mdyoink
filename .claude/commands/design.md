Research the codebase and propose an implementation design for: $ARGUMENTS

## Instructions

### Phase 1: Research

1. Read CLAUDE.md thoroughly — understand project conventions, architecture, and constraints
2. Identify the area of the codebase relevant to this task
3. Read all files in that area — understand how the existing code works, not just function signatures
4. Look for existing patterns that solve similar problems — these are your reference implementations
5. Check for constraints: import boundaries, naming conventions, required patterns

### Phase 2: Propose

Present your findings and proposal in this structure:

**Understanding:** One paragraph confirming what the task requires and any ambiguities.

**Reference implementations:** List existing files whose patterns this work should follow.

| Creating / Changing | Follow the pattern in | Key things to match |
|---------------------|----------------------|---------------------|
| [new file/change]   | [existing file path] | [specific aspects]  |

**Approach:** Describe the implementation approach in 3-5 bullet points.

**Files to change:**

| File   | Change        | Why         |
|--------|---------------|-------------|
| [path] | [one sentence] | [one sentence] |

**Boundary check:** Confirm no import boundary violations (content scripts stay self-contained, only service-worker/popup/options import from lib/).

**Risks:** Anything that could go wrong or needs extra attention.

## Critical Rule

Do NOT implement yet. Present the proposal and wait for the user to review, annotate, and approve before writing any code. The user may correct assumptions, reject approaches, add constraints, or redirect the design. Implementation begins only after explicit approval.
