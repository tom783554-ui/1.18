# Codex Automerge Automation

## What it does
The Codex Automerge workflow listens for Codex-authored pull requests and automatically approves them (if required), waits for required checks to finish, and then merges them into `main` using the GitHub CLI. It uses only the default `GITHUB_TOKEN` for authentication.

## When it runs
The workflow triggers on `pull_request_target` events of type `opened`, `synchronize`, `reopened`, and `ready_for_review`, and only runs when all of the following are true:

- The PR is **not** from a fork (the head repository matches this repository).
- The PR author login contains `codex` (case-insensitive) **or** the triggering actor contains `codex` (case-insensitive).

If required checks fail, the workflow exits without merging.

## How to verify it worked
- **Actions tab:** Open the repository’s **Actions** tab and look for the **Codex Automerge** workflow run to confirm the approve/check/merge steps completed.
- **PR timeline:** The pull request timeline should show an approval review and a merge event indicating the PR was merged by the workflow.
