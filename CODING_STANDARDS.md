# Coding Standards - Tacctile

## Agent-Driven Development
- **MANDATORY**: Every task must use an agent from `.claude_agents.yaml`
- **Agent Selection**: Choose most specific agent for the task
- **Agent Focus**: Stay within agent's scope and restrictions
- **Agent Switching**: Allowed when task requirements change

## Code Quality Rules

### TypeScript Standards
- Use strict type checking
- Define interfaces for all data structures
- Avoid `any` type - use proper typing
- Export types alongside implementations
- Use union types for constrained values

### File Organization
```
src/
├── main/              # Electron main process
│   ├── ipc/          # IPC handlers
│   ├── menu/         # Application menus
│   └── windows/      # Window management
├── renderer/          # React frontend
│   ├── components/   # Reusable UI components
│   ├── pages/        # Full page components
│   ├── hooks/        # Custom React hooks
│   └── contexts/     # React contexts
├── services/          # Business logic layer
├── hardware/          # Hardware integrations
├── ai/               # ML models and processing
└── utils/            # Shared utilities
```

### Component Architecture
- **Functional Components**: Use React functional components with hooks
- **Single Responsibility**: One component per file, one purpose per component
- **Props Interface**: Define TypeScript interfaces for all props
- **Error Boundaries**: Wrap complex components in error boundaries
- **Performance**: Use React.memo for expensive components

### Performance Requirements
- **60fps Target**: All animations and real-time updates
- **Memory Management**: Dispose of resources properly
- **CPU Optimization**: Use Web Workers for heavy processing
- **Bundle Size**: Keep renderer bundle under 10MB
- **Startup Time**: App ready in under 3 seconds

### Error Handling
- **Try-Catch**: Wrap all async operations
- **IPC Errors**: Handle main/renderer communication failures
- **Hardware Errors**: Graceful degradation when devices unavailable
- **User Feedback**: Clear error messages for users
- **Logging**: Comprehensive error logging for debugging

## Architecture Patterns

### Electron IPC
- **Type-Safe Channels**: Define IPC channel interfaces
- **Error Propagation**: Pass errors through IPC properly
- **Performance**: Minimize IPC calls, batch when possible
- **Security**: Validate all data crossing process boundaries

### State Management
- **React Context**: For global app state
- **Local State**: useState/useReducer for component state
- **Persistence**: Save critical state to SQLite
- **Synchronization**: Handle concurrent state updates

### Media Processing
- **Streaming**: Use Web Workers for video/audio processing
- **Memory**: Proper buffer management for large media files
- **Real-time**: Maintain 60fps for live processing
- **Quality**: Preserve original quality, offer quality options

### Hardware Integration
- **Abstraction**: Abstract hardware behind service interfaces
- **Discovery**: Auto-discover and connect to devices
- **Resilience**: Handle device disconnections gracefully
- **Calibration**: Support sensor calibration and baselines

## Code Style

### Naming Conventions
- **Files**: kebab-case (video-processor.ts)
- **Components**: PascalCase (VideoPlayer)
- **Functions**: camelCase (processVideo)
- **Constants**: UPPER_SNAKE_CASE (MAX_FILE_SIZE)
- **Interfaces**: PascalCase with 'I' prefix (IVideoData)

### Function Design
- **Pure Functions**: Prefer pure functions when possible
- **Single Purpose**: One function, one responsibility
- **Type Safety**: Full TypeScript typing
- **Error Handling**: Return Result types or throw typed errors
- **Documentation**: JSDoc comments for complex functions

### Module Structure
```typescript
// Imports (external, then internal)
import React from 'react';
import { ipcRenderer } from 'electron';
import { VideoProcessor } from '../services/video-processor';

// Types and interfaces
interface VideoPlayerProps {
  src: string;
  onAnalyze?: (data: AnalysisResult) => void;
}

// Component implementation
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, onAnalyze }) => {
  // Component logic
};

// Default export
export default VideoPlayer;
```

## Testing Standards

### Unit Tests
- **Coverage**: Minimum 80% code coverage
- **Test Files**: Co-located with source files (.test.ts)
- **Mocking**: Mock hardware and external dependencies
- **Assertions**: Clear, descriptive test assertions

### Integration Tests
- **E2E Testing**: Full user workflow testing
- **Hardware Simulation**: Mock hardware devices for testing
- **Performance Testing**: Verify performance requirements
- **Error Scenarios**: Test error conditions and recovery

## Security Guidelines

### Data Protection
- **Encryption**: Encrypt sensitive evidence data
- **Access Control**: Limit hardware access permissions
- **Input Validation**: Validate all user inputs
- **File Safety**: Sanitize file paths and operations

### IPC Security
- **Validation**: Validate all IPC messages
- **Sandboxing**: Use Electron sandboxing when possible
- **Context Isolation**: Enable context isolation
- **CSP**: Implement Content Security Policy

## Performance Optimization

### Memory Management
- **Cleanup**: Dispose of resources in cleanup functions
- **Listeners**: Remove event listeners when unmounting
- **Large Objects**: Stream large media files instead of loading entirely
- **Caching**: Cache expensive computations with TTL

### CPU Optimization
- **Web Workers**: Move heavy processing off main thread
- **Debouncing**: Debounce rapid user interactions
- **Lazy Loading**: Load components and data on demand
- **Efficient Algorithms**: Use appropriate data structures

## Build and Deployment

### Development
- **Hot Reload**: Fast development iteration
- **Source Maps**: Debugging support
- **Type Checking**: Real-time TypeScript checking
- **Linting**: ESLint and Prettier integration

### Production
- **Minification**: Minimize bundle sizes
- **Code Splitting**: Lazy load non-critical code
- **Tree Shaking**: Remove unused code
- **Optimization**: Webpack/Vite optimizations

## Documentation Requirements

### Code Comments
- **Complex Logic**: Explain non-obvious implementations
- **API Documentation**: JSDoc for public functions
- **TODO Comments**: Track technical debt
- **Hardware Notes**: Document hardware-specific implementations

### Change Documentation
- **Commit Messages**: Descriptive commit messages
- **Pull Requests**: Clear PR descriptions
- **Architecture Decisions**: Document major architectural choices
- **API Changes**: Document breaking changes