# CLAUDE.md - Tacctile

## What is Tacctile

Tacctile is a collaborative timeline platform for organizing, reviewing, and annotating media files. Users capture video, audio, images, and notes in the field, then use Tacctile's tools to review, flag, and collaborate on that media.

The platform is sector-agnostic. It serves any workflow where people capture and review media together — documentation teams, field researchers, event coverage, inspections, creative productions, and beyond. No single industry or use case defines it.

---

## Core Architecture: BYOS

**Bring Your Own Storage.**

Tacctile never stores user files. Users connect their own cloud storage (Google Drive, Dropbox, OneDrive) or work locally. Tacctile reads from and writes to the user's storage.

This is a zero-liability model. Users own their data completely. They can disconnect from Tacctile at any time and retain everything.

This principle is non-negotiable and affects every architectural decision.

---

## Metadata-Driven Design

File placement, organization, and context are determined by metadata — not manual arrangement.

- Timeline position comes from capture timestamp in file metadata
- Swim lanes are determined by user or device
- Flags reference specific timestamps within files
- Exports carry metadata about origin, creator, and creation time
- File details (device, settings, duration, dimensions) are extracted and displayed

Users do not manually place files on the timeline. The metadata tells Tacctile where everything belongs. This ensures accuracy and enables automatic organization across collaborators and devices.

**Files without metadata:** Legacy files or files that have lost their metadata are placed at the beginning of the timeline. Users may manually position these as an exception to the automatic placement rule.

---

## Terminology

| Term | Meaning |
|------|---------|
| Project | The root container — holds all files, flags, collaborators, and metadata for a body of work |
| Files | Everything users add — video, audio, images, notes, documents |
| Flags | Markers or annotations on files — points of interest, notes, highlights |
| Timeline | The chronological view showing all files positioned by capture timestamp |
| Knox | The AI assistant that provides context-aware help within projects |
| Session | A user's login/work period for audit purposes only — not a data container |
| Owner | The single user who has full control of a project |
| Collaborator | Anyone invited to contribute to a project |

Use this terminology consistently. When referring to the container of work, say "project" — never "session." When referring to media and documents, say "files" — never "evidence" or "assets."

---

## Guiding Principles

### 1. Original files are sacred

Never modify source files. All edits are non-destructive. Original media is read-only. Exports and modifications are saved separately.

### 2. User owns their data

Everything lives in the user's storage. Tacctile is an interface, not a vault. Users can leave at any time with all their files intact.

### 3. Sector-agnostic

No domain-specific language in the UI or codebase. The platform works for a wedding photographer, a construction inspector, and a research team equally. Avoid terminology that assumes a specific industry.

### 4. Collaboration-first

Multiple users work on the same project simultaneously. Real-time sync, multi-user flagging, shared timelines. Design every feature assuming collaboration.

### 5. Progressive complexity

Simple capture experience on mobile. Full editing and review power on desktop. Don't overwhelm casual users. Don't limit power users.

---

## What Never to Do

- **Never modify original files** — All edits produce new exports, never overwrite sources
- **Never store user files on Tacctile infrastructure** — BYOS is absolute
- **Never use domain-specific language** — No "evidence," "investigation," "anomaly," or other niche terminology
- **Never assume a single use case** — The platform serves many industries
- **Never break existing functionality** — Test before merging, preserve what works
- **Never allow manual file placement** — Timeline position comes from metadata (except for legacy files without metadata)

---

## How to Work on This Codebase

### Read before you write

Examine the existing code to understand current patterns. Types, stores, and components establish conventions. Follow them.

### One thing at a time

Make focused changes. One logical unit per commit. Don't combine unrelated modifications.

### Don't assume broken

Much of the codebase may be scaffolded but not yet wired. If something looks incomplete, it probably is intentional — not broken. Ask if unclear.

### Follow established patterns

The codebase uses specific patterns for state management, component structure, and styling. Match what exists rather than introducing new approaches.

### Test before pushing

Run the build. Check the preview deployment. Verify the app loads and basic functionality works.

---

## Knox — The AI Assistant

Knox is Tacctile's built-in AI assistant. Knox has project-level context and memory that persists with the project (stored in user's cloud, not Tacctile infrastructure).

Knox helps users:
- Understand their files and flags
- Get summaries and insights
- Navigate complex projects
- Answer questions about their media

Knox's memory belongs to the project, not to Tacctile.

---

## Mobile Experience

Mobile is not a separate app. It's a responsive web experience optimized for capture. When the browser viewport is mobile-sized, Tacctile presents a simplified capture-focused interface.

Mobile users primarily:
- Capture photos, video, audio, and notes
- Send captures directly to the project
- View basic project status

Full editing and review happens on desktop.

---

## Collaboration Model

- **One owner per project** — Full control, can transfer ownership
- **Collaborators can edit** — Add files, create flags, export
- **Real-time sync** — Changes propagate to all users
- **Audit trail** — Track who did what and when

Ownership transfer requires explicit confirmation. Collaborators cannot delete the project or remove the owner.

---

## File Organization in User's Cloud

Projects create a folder structure in the user's connected storage:

- Original media is preserved untouched in a dedicated location
- Exports go to separate folders by type
- Project data (flags, metadata, settings) is stored alongside
- Knox memory lives with the project

The exact structure may evolve, but the principle remains: organized, user-owned, portable.

---

## Export Philosophy

Exports use consistent naming that includes:
- Indication that it's an export
- Original filename reference
- Who created the export
- When it was created

This ensures exports are traceable and don't overwrite originals.

---

## What Tacctile Is Not

- **Not a storage provider** — Users bring their own storage
- **Not an editing suite** — Tools enhance and annotate, not replace professional editors
- **Not a single-industry tool** — No domain assumptions
- **Not a social platform** — Collaboration is for work, not sharing publicly

---

*This document defines how to think about Tacctile. For current implementation details, read the codebase itself.*
