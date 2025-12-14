Task: Generate a Current State Summary for a planning session.

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

8. INCOMPLETE/WIP INDICATORS
Scan for TODO, FIXME, WIP, placeholder, mock comments. List: file path, line number, comment text.

9. COMPONENT-TO-STORE WIRING
For each major tool component, state whether it uses its dedicated store or local useState.

10. DATABASE SCHEMA
List tables from supabase/schema.sql with one-line purpose for each.

Output as plain text I can paste into a chat. No file creation. Target 200-300 lines.
