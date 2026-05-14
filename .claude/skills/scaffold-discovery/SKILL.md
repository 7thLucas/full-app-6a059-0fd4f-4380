---
name: scaffold-discovery
description: Mandatory discovery skill for code generation. Use this to search for and select existing scaffolds (modules/templates) before implementing any code to ensure reuse and avoid manual generation.
---

# Scaffold Discovery Skill

You are responsible for discovering scaffolds and orchestrating their installation. This skill performs **discovery and selection**; actual installation is performed by the `inject_scaffold` MCP tool, which is the only sanctioned mechanism for vendoring a scaffold into the project.

## Unified Workflow

### Step 1: Scaffold Discovery
- **Prerequisite for Code Generation**: Before generating any code or implementing new features, you MUST search for existing scaffolds to avoid redundant work.
- **Proactive Search**: Hunt for scaffolds that solve high-level goals.
- **Command**: Run `python .claude/skills/scaffold-discovery/search_scaffolds.py "query"` via Bash (path is relative to the workspace cwd).
- **Timing**: Perform this at the very start of any task or code generation request.
- **Output contract**: stdout is a single JSON object:
  ```json
  {"query": "...", "results": [...], "errors": [...]}
  ```
  Exit codes: `0` success (results may be empty), `2` invalid input, `3` config error, `4` upstream/Qdrant unreachable.

### Step 2: Selection
- **Guard**: Only select scaffolds explicitly returned in `results` by the search in Step 1. Do NOT define or modify your own scaffolds if they were not present in the Step 1 output.
- **Discovery failures**: If `search_scaffolds.py` exits non-zero, returns a non-empty `errors` array, or returns an empty `results` array, you MUST proceed with manual code generation. Do NOT call `inject_scaffold` with a slug that did not appear in `results`. **STRICT RULE**: Do NOT manually create any folders inside `app/modules/` yourself during manual generation.
- Review results. Select ALL scaffolds that are relevant or beneficial.
- **Announcement**: Tell the user which scaffolds you identified and provide a 1-sentence technical reason for each.

### Step 3: Integration & Execution
Each scaffold has a `slug` field.

1. Call `inject_scaffold` with the `slug` taken VERBATIM from the search result. The injector vendors the repo into `app/modules/<slug>/`, links it via package.json `file:` dependency, runs an optional `prepscript.sh`, and merges any `.env.example` keys.
2. **Directory Ownership**: Do NOT create a folder yourself for the scaffold. This is a generated folder managed by `inject_scaffold`. You are only allowed to make changes to the content inside `app/modules/<slug>/` after it is injected. You are NOT allowed to create the folder itself in a custom way.
3. **Dependencies**: Each scaffold already contains its own `package.json` file inside `app/modules/<slug>/`. Do NOT create a new `package.json` at the root of the project to add its dependencies; respect the existing `package.json` inside the scaffold folder. Assume additional `package.json` changes are handled by the system later. Do NOT mock libraries.
4. **Clean Up**: After integration, fix broken imports, paths, or basic TS errors.

## Critical Rules
- **No target_dir**: None of the ENGINEER tools accept a target directory argument. The runner captures it from the active turn's cwd.
- **Scaffold Folders**: Never create `app/modules/<slug>` or any scaffold directories yourself using manual creation tools. Always use `inject_scaffold`.
- **Manual Modules**: Do NOT manually create folders or initialize modules under `app/modules/*`. This directory is strictly reserved for the scaffold injection system.
- **Efficiency**: Read files maximum once. Use `CLAUDE.md` as the authoritative project reference.
