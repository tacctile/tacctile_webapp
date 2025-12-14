You have full access to the uploaded repository ZIP.

ENVIRONMENT ASSUMPTIONS (MANDATORY)
- This project is developed entirely via Claude Code on the web.
- All code changes occur directly against the GitHub repository.
- There is NO local development, NO localhost usage, and NO local execution.
- Claude Code generates code, shows preview deployments, and creates pull requests.
- Validation happens via hosted preview environments (e.g. Vercel previews) and CI.
- Any references to “running”, “building”, or “executing” are conceptual or CI-based only.

GOAL
Produce a SINGLE, COMPLETE, paste-ready MARKDOWN DOCUMENT that captures the ENTIRE technical landscape of this repository so future chats NEVER need to ask:
- where files live
- where state lives
- where logic lives
- how features are wired
- how persistence works

This document will be saved as a .md file and reused across multiple chat sessions.
It replaces repeated ZIP uploads.

STRICT REQUIREMENTS
- Output ONE markdown document only
- No commentary before or after
- Do NOT ask clarification questions
- Be explicit and exhaustive
- Prefer exact file paths over descriptions
- Do NOT paste full source files
- Assume this document must stand alone for weeks

If output size becomes large:
- Prioritize sections 4–7 and 12 first
- Compress directory listings if needed
- Accuracy > verbosity

==================================================
OUTPUT FORMAT (USE THESE HEADINGS EXACTLY)
==================================================

# PROJECT TECHNICAL LANDSCAPE SNAPSHOT

## 0) Snapshot Metadata
- Repo name:
- Snapshot date:
- Primary languages:
- Frameworks/libraries:
- Runtime environment (browser-only):
- Package managers:
- CI/CD platform:
- Deployment platform:
- Monorepo (yes/no):

## 1) High-Level Overview
One concise paragraph describing what the system is, what it does, and how it is structured TODAY.

## 2) Authoritative Repository Structure
Provide a COMPLETE directory tree showing where EVERYTHING lives.
Exclude only dependency/build artifacts (node_modules, dist, build).
This section should eliminate all ambiguity about file locations.

## 3) Application Entry Points
List ALL entry points with exact file paths:
- App bootstrap
- Routing/navigation root
- Tool/module entry points
- Any alternate modes, views, or windows

## 4) State Management Map (CRITICAL)
For EACH state store:
- Store name
- File path
- What data it owns
- What components read from it
- What services mutate it
- What persists across navigation
- What persists across reloads

This section must fully answer “where does this state live?”

## 5) Tool / Feature Breakdown (EXHAUSTIVE)
For EACH major tool or feature:
- Name
- Purpose
- UI entry file(s)
- State store(s)
- Service(s)
- File source (local FS API, cloud, public)
- Persistence behavior

## 6) File Loading & Persistence Model
Explain EXACTLY:
- Where files originate
- How files are identified (IDs, handles, paths)
- How “active file” is tracked
- What survives tool navigation
- What survives browser reloads
- What cannot survive reloads due to browser security
- File paths responsible for each behavior

## 7) Services Layer Map
For EACH service:
- Name
- File path
- Responsibility
- External APIs or SDKs
- Which stores/components depend on it

## 8) Data & Persistence
- Datastores used
- Schema locations
- Table/collection purposes
- Realtime mechanisms
- Browser persistence (IndexedDB, localStorage, etc.)
- Where persistence logic lives

## 9) Cross-Cutting Concerns
With exact file paths:
- Authentication
- Authorization
- Billing
- AI integrations
- Logging / telemetry
- Error handling
- Feature flags

## 10) Known TODOs / Placeholders / Mock Logic
List ALL unfinished areas with:
- File path
- What is missing
- Severity (low / medium / high)

## 11) Architectural Invariants & Constraints
Rules enforced by the codebase that must not be violated.

## 12) “Where Do I Change X?” Index (CRITICAL)
Explicit mappings:
- Change audio behavior → file paths
- Change persistence → file paths
- Change routing → file paths
- Change UI layout → file paths
- Add a new tool → file paths
- Modify auth/billing → file paths

==================================================
FINAL RULES
==================================================
- Output ONLY markdown
- Use exact file paths
- Assume no local development
- This document must prevent future clarification questions
