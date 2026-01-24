# Automation workflows

## What runs
- **CI gate (`.github/workflows/ci.yml`)** runs on pull requests and pushes to `main`. It installs dependencies and executes `preflight` (typecheck → lint → optional tests → build).
- **Codex auto-PR (`.github/workflows/codex-autopr.yml`)** runs on pushes to `codex/**` branches. It installs dependencies, runs `preflight`, opens or reuses a PR targeting `main`, and enables auto-merge (squash) when checks are green.

## How to use
1. Create a branch like `codex/<topic>` and push commits.
2. Wait for the `Codex Auto PR` workflow to pass preflight.
3. A PR targeting `main` appears automatically and is set to auto-merge once checks succeed.

## How to verify
- Use Vercel preview deployments attached to the PR or branch to validate changes before the auto-merge completes.

## Required repo settings
- **Workflow permissions:** In **Settings → Actions → General**, allow GitHub Actions to create and approve pull requests (workflow permissions must allow PR write operations).
- **Auto-merge:** In **Settings → General**, enable **Allow auto-merge** so the workflow can enable auto-merge on Codex PRs.
