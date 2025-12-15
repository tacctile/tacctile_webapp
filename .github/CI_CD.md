# CI/CD Documentation

This document explains the CI/CD setup for Tacctile, including workflows, local development practices, and troubleshooting.

## Overview

Tacctile uses GitHub Actions for continuous integration and Vercel for deployment. The CI pipeline runs automated checks on every push and pull request to ensure code quality.

## Workflows

### CI Workflow (`ci.yml`)

**Triggers:** Push to `main`, Pull requests to `main`

**Jobs:**

| Job          | Description                   | Estimated Time |
| ------------ | ----------------------------- | -------------- |
| `lint`       | ESLint code quality checks    | ~30s           |
| `type-check` | TypeScript type validation    | ~45s           |
| `test`       | Vitest unit tests + coverage  | ~15s           |
| `build`      | Production build verification | ~60s           |
| `e2e`        | Playwright E2E tests          | ~90s           |

**Total estimated time:** ~4 minutes (jobs run in parallel)

All jobs run independently and in parallel. If one job fails, others continue to completion so you can see all issues at once.

### PR Preview Workflow (`pr-preview.yml`)

**Triggers:** Pull request opened or updated

Runs the same checks as CI and posts a status comment on the PR summarizing results. Vercel handles the actual preview deployment.

### Dependabot (`dependabot.yml`)

**Schedule:** Weekly on Monday

Automatically creates PRs for:

- npm dependency updates (production and dev dependencies)
- GitHub Actions version updates

**Configuration:**

- Maximum 5 open PRs at a time
- Commit prefix: `deps:`
- Groups minor/patch updates to reduce PR noise

## Running Checks Locally

### Before Pushing

Run all checks locally to catch issues before CI:

```bash
# Run all checks in sequence
npm run lint && npm run type-check && npm test -- --run && npm run build
```

### Individual Checks

```bash
# Linting
npm run lint

# Type checking
npm run type-check

# Unit tests (single run, no watch)
npm run test -- --run

# Unit tests with coverage
npm run test:coverage

# Build
npm run build

# E2E tests (requires dev server or starts one)
npm run test:e2e

# Format code with Prettier
npm run format

# Check formatting without changes
npm run format:check
```

## Pre-commit Hooks

Husky and lint-staged are configured to run checks automatically on staged files before each commit.

### What Runs on Commit

For `.ts` and `.tsx` files:

- ESLint with auto-fix
- Prettier formatting

For `.json`, `.md`, and `.css` files:

- Prettier formatting

### Running Pre-commit Checks Manually

```bash
npx lint-staged
```

### Bypassing Pre-commit Hooks (Emergency Only)

```bash
git commit --no-verify -m "Emergency fix: description"
```

**Warning:** Only bypass in emergencies. All bypasses will still be caught by CI.

## Debugging CI Failures

### 1. Find the Failing Job

1. Go to the **Actions** tab in GitHub
2. Click on the failed workflow run
3. Identify which job(s) failed (marked with red X)

### 2. Read the Logs

1. Click on the failed job
2. Expand the failed step
3. Read the error messages

### 3. Common Issues

#### Lint Failures

```
Error: ESLint found errors
```

**Fix:** Run `npm run lint` locally and fix reported issues.

#### Type Check Failures

```
error TS2322: Type 'X' is not assignable to type 'Y'
```

**Fix:** Run `npm run type-check` locally and fix type errors.

#### Test Failures

```
FAIL src/component.test.tsx
```

**Fix:** Run `npm test` locally to see full test output.

#### Build Failures

```
error during build
```

**Fix:** Run `npm run build` locally to see full error output.

#### E2E Failures

```
Error: Timeout waiting for element
```

**Fix:** Check if the application UI changed. Run `npm run test:e2e:ui` locally for visual debugging.

### 4. Artifacts

Failed E2E tests upload Playwright reports as artifacts. Download from the **Artifacts** section of the workflow run.

## Dependabot Updates

### Reviewing Dependency PRs

1. Check the PR for breaking changes in the changelog
2. Verify CI passes
3. For major updates, test locally before merging
4. For grouped updates, review all included packages

### Grouping Strategy

- **production-deps:** Groups minor/patch updates for runtime dependencies
- **dev-deps:** Groups updates for development tools

Major version updates are not grouped to ensure careful review.

## Workflow Artifacts

### Coverage Report

Unit test coverage is uploaded after each CI run. Access from the workflow run's **Artifacts** section.

### Build Output

Production build artifacts are uploaded for inspection if needed.

### Playwright Report

Only uploaded on E2E test failures to help debug issues.

## GitHub Repository Secrets

Currently, no secrets are required for CI. If integrations require secrets:

1. Go to **Settings** > **Secrets and variables** > **Actions**
2. Add secrets as needed
3. Reference in workflows as `${{ secrets.SECRET_NAME }}`

## Vercel Deployment

Vercel's GitHub integration handles deployment automatically:

- **Preview deployments:** Created for every PR
- **Production deployments:** Triggered on merge to `main`

No GitHub Actions workflow is needed for Vercel deployment.

## First-Time Setup

After cloning the repository:

```bash
# Install dependencies (also runs 'prepare' script to set up husky)
npm install

# Verify everything works
npm run lint && npm run type-check && npm test -- --run && npm run build
```

## Troubleshooting

### Husky Not Running

If pre-commit hooks aren't running:

```bash
# Reinstall husky
npm run prepare
```

### npm ci Fails in CI

Clear npm cache and try again:

- Delete `package-lock.json` and run `npm install` to regenerate
- Ensure Node.js version matches (20.x)

### Playwright Browser Issues

If E2E tests fail to start browsers:

```bash
# Install browsers locally
npx playwright install --with-deps chromium
```
