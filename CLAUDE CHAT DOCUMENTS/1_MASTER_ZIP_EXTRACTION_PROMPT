You have full access to the uploaded repository ZIP.

GOAL
Produce a SINGLE, COMPLETE, paste-ready MARKDOWN DOCUMENT that captures the ENTIRE technical landscape of this repository so that future chats NEVER need to ask where files, logic, state, or functionality live.

This document will become the canonical technical reference for the project.
If output would exceed ~8,000–12,000 words, prioritize sections 4–7 and 12 first, then compress the repo tree.
Appendix A: Alphabetical index of key topics → exact file paths (Audio loading, flags, timeline, persistence, auth, etc.).

STRICT REQUIREMENTS
- Output ONE markdown document only
- No commentary before or after
- Do not ask clarification questions
- Assume this document must answer ALL future “where does X live?” questions
- Prefer explicit file paths over general descriptions
- Be exhaustive but structured
- This document replaces ZIP uploads in future chats

DO NOT:
- Paste full source files
- Omit file paths
- Say “varies” or “depends”
- Leave sections vague

==================================================
OUTPUT FORMAT (USE THESE HEADINGS EXACTLY)
==================================================

# PROJECT TECHNICAL LANDSCAPE SNAPSHOT

## 0) Snapshot Metadata
- Repo name:
- Snapshot date:
- Primary language(s):
- Frameworks/libraries:
- Runtime targets:
- Package manager(s):
- Build system:
- Deployment target(s):

## 1) High-Level Overview
One concise paragraph describing what the system is, what it does, and how it is structured TODAY.

## 2) Full Repository Structure (Authoritative)
Provide a FULL directory tree (trim only node_modules/build artifacts).
Depth as needed.
This section should allow someone to know exactly where ANYTHING lives.

## 3) Application Entry Points
List ALL entry points with file paths:
- App bootstrap
- Routing/navigation root
- Tool/module entry points
- Separate windows/modes (if any)

## 4) State Management Map (CRITICAL)
For EACH state store:
- Store name
- File path
- What it owns
- What tools/components read it
- What services mutate it
This section must remove ALL ambiguity about where state lives.

## 5) Tool / Feature Breakdown (EXHAUSTIVE)
For EACH major tool/feature:
- Name
- Purpose
- UI entry file(s)
- State store(s)
- Service(s)
- Data source (local, cloud, API, mock)
- Persistence behavior (if any)

## 6) File Loading & Persistence Model
Explain EXACTLY:
- Where files come from (local FS, cloud, public)
- How files are identified (IDs, paths, handles)
- How “active file” state is tracked
- What persists across navigation
- What persists across reloads
- Where this logic lives (file paths)

## 7) Services Layer Map
For EACH service:
- Name
- File path
- Responsibility
- External dependencies (APIs, SDKs)
- Which stores/components call it

## 8) Data & Persistence
- Datastores used
- Schema locations
- Table/collection purposes
- Realtime mechanisms
- Local persistence (IndexedDB, localStorage, etc.)

## 9) Cross-Cutting Concerns
- Auth
- Billing
- AI
- Logging
- Error handling
- Feature flags
Include file paths for each.

## 10) Known TODOs / Placeholders / Stubs
List ALL TODOs, mock implementations, placeholders, and unfinished areas with:
- File path
- What’s missing
- Severity

## 11) Invariants & Constraints
List architectural rules enforced by the codebase that must not be violated.

## 12) “Where Do I Change X?”
Explicit mapping:
- Want to change audio behavior → file paths
- Want to change persistence → file paths
- Want to change routing → file paths
- Want to change UI layout → file paths
- Want to add a new tool → file paths

==================================================
FINAL RULES
==================================================
- Output ONLY markdown
- Be explicit
- Assume this document must stand alone for weeks
- This document will be saved as a .md file and reused
