# Branch Protection Settings

This document outlines the recommended branch protection settings for the `main` branch in the Tacctile repository.

## How to Configure

1. Go to **Settings** > **Branches** in the GitHub repository
2. Click **Add branch protection rule** (or edit existing rule)
3. Enter `main` as the branch name pattern
4. Configure the settings below

## Recommended Settings

### Protect matching branches

#### Require a pull request before merging

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1** (adjust based on team size)
  - [ ] Dismiss stale pull request approvals when new commits are pushed
  - [ ] Require review from Code Owners
  - [x] Require approval of the most recent reviewable push

#### Require status checks to pass before merging

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Required status checks:
    - `Lint`
    - `Type Check`
    - `Unit Tests`
    - `Build`

#### Require conversation resolution before merging

- [x] **Require conversation resolution before merging**

#### Require signed commits

- [ ] Require signed commits (optional, enable if team uses GPG signing)

#### Require linear history

- [ ] Require linear history (optional, enable if using squash merge exclusively)

#### Do not allow bypassing the above settings

- [x] **Do not allow bypassing the above settings**
  - Even administrators must follow these rules

### Rules applied to everyone including administrators

#### Restrict who can push to matching branches

- [x] **Restrict who can push to matching branches**
  - Add specific users/teams who can push directly (use sparingly)

#### Allow force pushes

- [ ] **Do not allow force pushes**

#### Allow deletions

- [ ] **Do not allow deletions**

## Status Check Names

The CI workflow creates the following status checks:

| Status Check Name | Workflow Job                                        |
| ----------------- | --------------------------------------------------- |
| `Lint`            | ESLint checks                                       |
| `Type Check`      | TypeScript type checking                            |
| `Unit Tests`      | Vitest unit tests                                   |
| `Build`           | Vite production build                               |
| `E2E Tests`       | Playwright E2E tests (optional for required checks) |

## Emergency Bypass

In rare emergency situations where an urgent fix is needed and CI is broken:

1. An administrator can temporarily disable branch protection
2. Push the emergency fix
3. **Immediately re-enable branch protection**
4. Create a follow-up PR to properly fix CI issues

**Warning:** This should only be used in true emergencies. All bypasses should be documented in the PR or commit message.

## Vercel Integration

Vercel's GitHub integration will automatically:

- Deploy preview builds for all PRs
- Deploy to production on merge to `main`
- Create deployment status checks

These Vercel checks are separate from the CI checks and provide deployment-specific status.
