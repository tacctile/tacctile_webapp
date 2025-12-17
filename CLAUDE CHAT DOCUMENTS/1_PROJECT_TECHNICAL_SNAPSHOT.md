Task: Generate a Current State Summary for seamless handoff to a new chat session.
Read the codebase and output the following as plain text (not a file):

1. DIRECTORY STRUCTURE
List all folders in src/ with one-line descriptions of what each contains.

2. STORES (src/stores/)
For each store file: name, file path, what state it manages, key actions it exposes, whether it's actively used or placeholder.

3. SERVICES (src/services/)
For each service: name, file path, what it does, external APIs it connects to.

4. COMPONENTS BY TOOL
For each tool folder in src/components/, list the main component file and what UI it renders.

5. TYPES (src/types/)
For each file: name and the key interfaces/types it exports.

6. HOOKS (src/hooks/)
For each custom hook: name, file path, what it does.

7. CONTEXTS (src/contexts/)
For each context: name, file path, what state it provides.

8. ROUTING & NAVIGATION
List all routes, what component each renders, protected/auth-gated routes, navigation flow.

9. KEY DEPENDENCIES
Major packages from package.json with one-line purpose (Supabase, Zustand, React Router, date libraries, UI frameworks, etc.).

10. AUTH FLOW
How authentication works, what's protected, session management, user state handling.

11. DATA FLOW PATTERNS
How data moves: user action → store → service → database → UI update. Include any middleware, optimistic updates, error handling patterns.

12. ENVIRONMENT/CONFIG
Required env vars, API endpoints, external service configs, any .env.example contents.

13. COMPONENT-TO-STORE WIRING
For each major tool component, state whether it uses its dedicated store or local useState.

14. DATABASE SCHEMA
List tables from supabase/schema.sql with one-line purpose for each, key relationships between tables.

15. ACTIVE FEATURES vs PLANNED
What's fully implemented and working vs what's stubbed/WIP vs what's planned (from comments/TODOs).

16. BUILD/DEPLOYMENT
How to run locally (dev command), build process, deployment target/platform, any build configs.

17. INCOMPLETE/WIP INDICATORS
Scan for TODO, FIXME, WIP, placeholder, mock comments. List: file path, line number, comment text.

Output as plain text I can paste into a new chat. No file creation. Target 300-400 lines for complete context.
