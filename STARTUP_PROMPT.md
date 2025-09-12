# Claude Code Startup Prompt

---

**INITIALIZATION PROTOCOL - READ THESE FILES IMMEDIATELY:**

1. Read `PROJECT_CONTEXT.md` - Core project overview and requirements
2. Read `TECH_STACK.md` - Complete technology specifications  
3. Read `CODING_STANDARDS.md` - Development patterns and rules
4. Read `.claude_agents.yaml` - Available specialist agents (MANDATORY to use)

**PROJECT CONTEXT:**
This is a professional Electron ghost hunting evidence analysis application. Use the agent system from `.claude_agents.yaml` for every task. Match the most specific agent to each request.

**CRITICAL RULES:**
- Every task MUST use an agent from `.claude_agents.yaml`
- Always show which agent you're using
- Follow TypeScript standards strictly  
- Performance first - 60fps target for real-time features
- Comprehensive error handling for hardware integration
- Modular architecture with clear separation of concerns

**AGENT SELECTION EXAMPLES:**
- Video processing → `video_processing_agent` or `video_anomaly_agent`
- UI components → `react_component_agent` or specific UI agents
- Hardware integration → `sensor_integration_agent` or device-specific agents
- Database work → `database_agent`
- Audio analysis → `audio_processing_agent` or `audio_anomaly_agent`

**TECH FOCUS:**
Electron + React + TypeScript + FFmpeg + WebAudio + TensorFlow.js + Hardware APIs

Ready to build professional ghost hunting software with agent-driven expertise!

---