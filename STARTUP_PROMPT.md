MANDATORY STARTUP PROTOCOL - EXECUTE EVERY TIME:

1. READ .claude_master.yaml - This is your operating system
2. READ .claude_agents.yaml - These are your ONLY available agents
3. IGNORE all internal/default agent systems
4. NEVER use agents not defined in .claude_agents.yaml
5. Display: "✅ Custom agent system loaded - Ultimate guardrails active - 100% quality enforcement"

CRITICAL RULES:
- Every task MUST use an agent from .claude_agents.yaml
- Every response MUST show token usage
- Every change MUST be under 50 lines
- Quality over speed ALWAYS

VERIFICATION:
□ Custom agents loaded
□ Master rules active
□ Agent selection ready

COMMON AGENT SEQUENCES:
UI changes → test with widget_test_agent
API work → add error_handler_agent
New feature → follow with integration_test_agent

AUTO-COMMIT PROTOCOL:
- After every completed task, automatically run: git add . && git commit -m "✅ [AGENT_NAME] [TIME]: Task_description" && git push
- NEVER ask permission to commit - just do it automatically
- Use descriptive commit messages based on what was actually changed
- If commit fails, inform user but continue with next task
- Commit frequency: After every functional change or every 10 minutes during long tasks

Layout Structure Standards:
- Column-based screens: All tool screens use main Column with Expanded sections
- Three-tier layout: Display area (flex: 3), readouts (flex: 2), controls (flex: 1)
- SafeArea compliance: Always wrap in SafeArea, never assume status bar height
- Flexible sizing: Use Expanded, Flexible, and IntrinsicHeight - NEVER fixed heights
- Container padding: Consistent EdgeInsets patterns, responsive to screen size

Overflow Prevention (CRITICAL):
- Never use fixed heights: Always use Expanded or Flexible in Columns
- ListView for scrollable content: Any content that might overflow gets ListView wrapper
- SingleChildScrollView: For forms or content that needs vertical scrolling
- Intrinsic sizing: Use IntrinsicHeight for Rows, IntrinsicWidth for complex layouts
- Screen size awareness: Always account for different screen sizes and orientations

Widget Composition Patterns:
// CORRECT: Expandable layout preventing overflow
Column(
  children: [
    Expanded(flex: 3, child: displayArea),
    readoutsSection,  // Fixed height content
    Expanded(flex: 1, child: controlsSection),
  ],
)

// WRONG: Fixed heights cause overflow
Column(
  children: [
    Container(height: 400, child: displayArea),  // NEVER DO THIS
    Container(height: 200, child: readouts),
    Container(height: 100, child: controls),
  ],
)

State Management Architecture:
- StatefulWidget pattern: All screens use setState() for updates
- StreamSubscription management: Proper listen/cancel lifecycle
- Timer management: Declare all timers as class variables, cancel in dispose()
- Controller lifecycle: Initialize in initState(), dispose in dispose()
- Resource cleanup: Every subscription/controller MUST be disposed

Navigation Architecture:
- WillPopScope pattern: Every tool screen implements proper back navigation
- Navigator.pop() only: Never use SystemNavigator.pop()
- Nested navigation: Home tab uses dedicated NavigatorState
- Route management: String-based routing with proper error handling

Performance Patterns:
- Efficient rebuilds: Minimize setState() scope, use AnimatedBuilder for animations
- Timer frequency: 60fps (16ms) for animations, appropriate intervals for sensors
- Memory management: Dispose controllers, cancel subscriptions, clear lists
- Widget reuse: Extract complex widgets into methods, avoid rebuilding static content

Error Handling Standards:
- Try-catch blocks: Wrap all async operations and sensor access
- Null safety: Proper null checks and default values
- Permission handling: Check permissions before sensor access
- Resource availability: Check if controllers/services are initialized
- Graceful degradation: App continues functioning when sensors unavailable

Service Layer Architecture:
- Singleton pattern: Global services use factory constructor pattern
- Service initialization: Initialize once in main(), never dispose
- Dependency injection: Pass services through constructors when needed
- File operations: Use proper async/await with error handling
- Permission services: Centralized permission management

Modal System Standards:
- Overlay pattern: Stack-based modals with gesture dismissal
- Consistent structure: Container with margin/padding, decoration patterns
- Keyboard handling: Account for keyboard appearance/dismissal
- Focus management: Proper TextField focus and dismissal
- State cleanup: Reset modal state on close

Animation Architecture:
- Controller management: One controller per animation type
- Dispose pattern: Always dispose animation controllers
- Performance optimization: Use vsync: this, proper curve selection
- Smooth transitions: Appropriate duration and easing curves

Data Persistence Patterns:
- SharedPreferences: Simple key-value storage, proper async handling
- File operations: Use path_provider, proper directory management
- JSON serialization: toJson/fromJson methods for all data models
- Temp file management: Clean up temporary files, proper file lifecycle

Sensor Integration Standards:
- Stream handling: Single subscription per sensor, proper error handling
- Real-time updates: Efficient data processing, avoid blocking UI
- Calibration support: Baseline establishment and adjustment patterns
- Hardware abstraction: Handle missing sensors gracefully

Widget Testing Foundations:
- Testable architecture: Separate business logic from UI components
- Mockable services: Use abstract interfaces for services
- Widget composition: Extract complex widgets for easier testing
- State verification: Ensure state changes are testable

CRITICAL IMPLEMENTATION RULES

Layout Rules (NEVER BREAK):
- No hardcoded heights/widths in main layout structures
- Always use Expanded/Flexible in Column/Row children that need to fill space
- Wrap scrollable content in ListView or SingleChildScrollView
- Test on multiple screen sizes - small phones to tablets
- Account for system UI - status bars, navigation bars, notches

Code Quality Rules:
- Complete disposal - every controller, subscription, timer gets disposed
- Null safety first - check for null before accessing properties
- Error boundaries - try-catch around all risky operations
- Resource checks - verify services/controllers before use
- Memory consciousness - avoid memory leaks through proper cleanup

Performance Rules:
- Efficient rebuilds - minimize setState scope
- Appropriate timers - match frequency to actual needs
- Smart caching - cache expensive calculations/operations
- Widget optimization - use const constructors where possible
- Animation efficiency - proper controller management and disposal

Testing Requirements:
- Multiple screen sizes - test phone and tablet layouts
- Orientation changes - ensure layouts work in both orientations
- System UI variations - different status bar heights, notches
- Memory stress testing - long-running sessions without leaks
- Permission scenarios - graceful handling of denied permissions

WHEN IMPLEMENTING NEW FEATURES

Layout Checklist:
- Uses Expanded/Flexible instead of fixed dimensions
- Handles overflow with ListView/SingleChildScrollView
- Tested on small and large screens
- No hardcoded pixel values in layout structure
- Proper SafeArea implementation

Code Quality Checklist:
- All controllers disposed in dispose()
- All subscriptions cancelled
- Try-catch around async operations
- Null checks before property access
- Memory leak prevention

Performance Checklist:
- Timers run at appropriate frequency
- setState() scope minimized
- No unnecessary rebuilds
- Animation controllers properly managed
- Resource cleanup verified

LEAN CODE ENFORCEMENT (CRITICAL)

Bloat Prevention Rules:
- Minimal dependencies: Only add packages when absolutely necessary
- Single responsibility: Each widget/method does ONE thing only
- Direct implementations: Avoid over-abstraction and complex inheritance
- Essential features only: No "nice to have" features without explicit request
- Efficient data structures: Use appropriate collections (List, Set, Map) for the job

Performance-First Coding:
- Lazy initialization: Initialize expensive resources only when needed
- Dispose everything: Every controller, subscription, timer gets cleaned up
- Minimal rebuilds: Use const widgets, extract static content
- Smart caching: Cache expensive calculations, avoid redundant operations
- Direct widget composition: Avoid unnecessary wrapper widgets

Lean Widget Architecture:
// GOOD: Direct, lean implementation
Widget _buildButton() {
  return GestureDetector(
    onTap: _handleTap,
    child: Container(
      decoration: BoxDecoration(...),
      child: Text(_label),
    ),
  );
}

// BAD: Over-abstracted, heavy wrapper
class CustomButton extends StatefulWidget {
  // Unnecessary complexity for simple button
}

Resource Efficiency:
- Single timers: One timer per screen maximum, combine operations
- Efficient listeners: Combine multiple sensor streams when possible
- Memory awareness: Clear collections, dispose resources immediately
- CPU optimization: Avoid expensive operations in build methods
- Battery consciousness: Appropriate sensor polling rates

Code Simplicity Rules:
- Prefer composition over inheritance - build with widgets, not complex classes
- Avoid premature optimization - but always dispose resources properly
- Direct API usage - don't abstract working patterns unnecessarily
- Essential imports only - remove unused imports immediately
- Minimal state variables - only track what actually changes

Anti-Bloat Checklist:
- No unused imports or variables
- No unnecessary abstraction layers
- Direct widget composition used
- Single timer per screen maximum
- Resources disposed immediately when done
- Build methods contain no expensive operations
- Collections cleared when no longer needed

CODE QUALITY MANDATES (Zero Tolerance)

Banned Practices:
- No commented-out code: Delete it or uncomment it - dead code creates confusion
- No console.log in production: Use proper logging_agent only
- No magic numbers: Extract to constants with MEANINGFUL names (BAD: 1000, GOOD: MAX_FILE_SIZE_MB)
- No duplicate code: If used 3+ times, extract to reusable function
- No TODO comments: Create GitHub issue with context or fix immediately
- No empty catch blocks: Always handle or log errors explicitly
- No hardcoded paths: Use path helpers and environment variables
- No inline styles in JSX: Use proper CSS classes or styled components

Naming Standards:
- Variables: camelCase and descriptive (videoAnalysisResults, not var1)
- Functions: verbNoun format (processAudioFile, detectAnomalies)
- Constants: SCREAMING_SNAKE_CASE (MAX_VIDEO_LENGTH_SECONDS)
- Components: PascalCase (AudioWaveform, not audioWaveform)
- Files: Match primary export (AudioWaveform.jsx, not component.jsx)
- Booleans: is/has/should prefix (isRecording, hasPermission)

INLINE DOCUMENTATION (Required)

Comment Requirements:
- Complex functions: JSDoc with purpose, params, returns, example
- Non-obvious logic: Comment explaining WHY, not WHAT
- Magic constants: Comment explaining source/reasoning/units
- API integrations: Rate limits, auth requirements, error codes
- Workarounds: Explain the problem being worked around
- Performance optimizations: Why this approach is faster

Plain English Summaries (After Every Change):
- "What I Built" in 2-3 sentences
- "Why This Way" explanation for architecture changes
- "How It Works" with API flow for integrations
- "What Was Broken" and "How I Fixed It" for bug fixes

GIT DISCIPLINE (Bulletproof Versioning)

Atomic Commits:
- One logical change per commit (not "fixed stuff")
- Working state before AND after commit (test both)
- Breaking changes: Flag with [BREAKING] in message
- Rollback ready: Every commit must be safely revertible

Commit Message Format:
Template: "✅ [AGENT_NAME] [TIME]: Brief description (why, not what)"

Examples:
- "✅ [audio_processing_agent] [14:32]: Added noise reduction to prevent distortion on high-gain recordings"
- "✅ [database_agent] [09:15]: Indexed timestamp column to fix slow evidence search"
- "✅ [ui_component_agent] [16:45]: Made timeline scrubber keyboard-accessible for screen readers"

Before Commit Checklist:
- Feature actually works (manually tested)
- No console errors in browser/terminal
- No new warnings introduced
- Resources properly disposed (no memory leaks)
- Follows project patterns (matches existing code style)

PERFORMANCE MONITORING (Prevent Slowness)

Mandatory Logging:
- Log execution time for all AI API calls (track cost/latency)
- Track memory usage before/after media processing
- Monitor file I/O operations >100ms
- Alert on ANY operation taking >2000ms
- Count active subscriptions/timers (detect leaks)

Optimization Triggers:
- If operation >1000ms: Investigate and optimize or explain why acceptable
- If memory grows >100MB: Check for leaks and cleanup
- If UI freezes: Move to worker thread or break into chunks
- If API calls fail >5%: Add retry logic with exponential backoff

SECURITY BASELINE (Protect User Data)

Absolute Requirements:
- No API keys in code: Use .env file and environment variables ONLY
- No secrets in git: Add .env to .gitignore immediately
- Sanitize ALL user input: Never trust user-provided data
- Validate file types: Check magic bytes, not just extensions
- Path traversal prevention: Validate all file paths before operations
- Rate limit API calls: Prevent abuse and cost overruns
- Encrypt sensitive data: Use proper encryption for user credentials

Danger Operations:
- File deletion: Confirm twice and log what was deleted
- Database writes: Validate data before committing
- External API calls: Timeout after 30 seconds
- User permissions: Request only when needed, explain why

VALIDATION REQUIREMENTS (Non-Coder Quality Control)

Self-Verification After Every Code Change:
- Plain English explanation: What does this code do?
- Testing instructions: Exactly how to verify it works
- Potential failures: What could go wrong and how it's handled
- Rollback plan: If this breaks, here's how to revert
- Dependencies: Does this require any external setup?

Architectural Decisions:
- Why this approach: Explain alternatives considered
- Trade-offs: What did we sacrifice for this benefit?
- Future impact: How does this affect future features?
- Performance implications: Will this scale to 1000 users?

Integration Explanations:
- API flow: Request → Processing → Response (with error paths)
- Data flow: Where data comes from, how it's transformed, where it goes
- State management: What variables track what, and why
- Error scenarios: What happens when things fail

RED FLAGS (Immediate Alert System)

Report Immediately If:
- Any "This might not work because..." → Stop and get clarification
- Any "You'll need to manually..." → Automate it or document extensively
- Any "This requires external setup..." → Provide step-by-step instructions
- Any "I'm not sure if..." → Research and verify before proceeding
- Any "This is a workaround..." → Explain why proper solution isn't used

Dangerous Patterns:
- Nested try-catch blocks → Refactor to clearer error handling
- Functions >100 lines → Break into smaller, focused functions
- Deep nesting >4 levels → Extract into helper functions
- Copy-pasted code → Create reusable function immediately
- Global mutable state → Use proper state management

ERROR PREVENTION (Catch Issues Early)

Mandatory Checks:
- Null/undefined checks: Before accessing any property
- Array bounds: Before accessing array elements
- File existence: Before reading/writing files
- Network connectivity: Before API calls
- Permissions granted: Before accessing hardware
- Valid input: Before processing user data

Error Handling Pattern:
- Try-catch around ALL async operations
- User-friendly error messages (not technical jargon)
- Log full error details for debugging
- Graceful degradation (app continues working when possible)
- Clear recovery instructions for user

TESTING REQUIREMENTS (Non-Coder Can Verify)

Every Feature Includes:
- Happy path: Step-by-step instructions to test normal usage
- Edge cases: What weird inputs or scenarios to test
- Error cases: How to trigger errors and verify handling
- Cleanup: How to reset to clean state after testing
- Success criteria: Exactly what "working" looks like

Test Scenarios Template:
1. Setup: What state the app needs to be in
2. Action: Exact steps to perform
3. Expected: What should happen (specific, measurable)
4. Verify: How to confirm it worked
5. Cleanup: How to return to starting state

DEPENDENCY MANAGEMENT (Prevent Bloat)

Before Adding Any Dependency:
- Is this absolutely necessary? Can we build it ourselves in <1 hour?
- Is it actively maintained? (updated within last 6 months)
- Is it popular/trusted? (1000+ GitHub stars or official)
- Is it lightweight? (check bundle size)
- Does it have security issues? (check npm audit)

Dependency Alternatives:
- Instead of moment.js → use native Date or date-fns (smaller)
- Instead of lodash (full) → import specific functions only
- Instead of jQuery → use vanilla JavaScript
- Instead of heavy UI library → build custom components

REFACTORING TRIGGERS (Keep Code Clean)

Code Smells:
- Function does >1 thing → Split into focused functions
- File >500 lines → Break into smaller modules
- Repeated code pattern → Extract to reusable component
- Unclear variable names → Rename to be descriptive
- Complex conditional logic → Simplify or extract to function

Refactoring Rules:
- Only refactor working code (don't fix what ain't broke)
- Commit before refactoring (so you can revert)
- Test after refactoring (ensure nothing broke)
- One refactor at a time (don't combine with new features)

BUILD VERIFICATION (Ensure Deployability)

Before Every Build:
- All tests pass (or explain why skipped)
- No console errors or warnings
- No TODO comments in production code
- All dependencies up to date (or pinned intentionally)
- Environment variables documented in .env.example
- README includes setup instructions for new developers

Build Success Criteria:
- App starts without errors
- All features work as expected
- Performance is acceptable (no lag)
- Memory usage is stable (no leaks)
- File size is reasonable (<100MB installer)

COMMUNICATION PROTOCOL (Non-Coder Friendly)

Explain in Plain English:
- Avoid jargon: Use simple words (not "instantiate", say "create")
- Use analogies: Compare to real-world concepts
- Show examples: Don't just describe, demonstrate
- Admit uncertainty: Say "I don't know" instead of guessing

Provide Context:
- Why this matters: Connect technical choice to user benefit
- What changed: Summarize before/after clearly
- What's next: Suggest logical next steps
- What to watch: Potential issues to monitor

EMERGENCY PROTOCOLS (When Things Break)

Debugging Workflow When Feature Breaks:
Step 1: Identify last working commit (git log)
Step 2: Revert to last working state (git revert)
Step 3: Reproduce issue with clear steps
Step 4: Isolate problem (which specific change broke it)
Step 5: Fix issue with minimal changes
Step 6: Test thoroughly before committing
Step 7: Document what broke and how it was fixed

When Completely Stuck:
- Stop coding immediately
- Document exactly what's not working
- List what you've already tried
- Explain what you're trying to achieve
- Ask for alternative approaches

QUALITY GATES (Must Pass Before Moving Forward)

Feature Completion Requirements:
- Feature works as described (tested manually)
- Error handling is in place
- Code is committed with clear message
- Plain English explanation written
- Testing instructions provided

Integration Completion Requirements:
- API calls work in all scenarios (success, failure, timeout)
- Error messages are user-friendly
- Rate limiting is in place
- Credentials are in environment variables
- Integration tested end-to-end

ACCOUNTABILITY METRICS (Track Progress)

End of Session Summary:
- What was completed today
- What's blocked or needs attention
- What's next on the roadmap
- Any concerns or risks identified
- Estimated time to next milestone

Weekly Health Check:
- Code quality: Any technical debt accumulated?
- Performance: Any slowdowns introduced?
- Test coverage: Are new features tested?
- Documentation: Is README up to date?
- Dependencies: Any security vulnerabilities?

ENFORCEMENT PROTOCOL

Claude Must Acknowledge at Every Session Start:
"✅ Ultimate guardrails loaded - 100% quality enforcement active"

Violation Response:
If any rule is broken:
1. Stop immediately
2. Explain which rule was violated and why
3. Revert the change
4. Implement correctly following the rule
5. Document why the rule exists to prevent future violations

FINAL REMINDER: This user cannot code. Every line must be flawless. No shortcuts. No assumptions. Test everything. Explain everything. Quality is non-negotiable.