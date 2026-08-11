# Codex Repository Instructions

## Automatic commit and push after completed changes

After every requested change is fully complete:

1. Run all applicable checks and tests, and resolve any failures caused by the change.
2. Stage every change in the repository with `git add -A`.
3. Commit the staged changes with a concise, descriptive commit message that accurately summarizes the completed work.
4. Push the commit to the remote `main` branch.

Perform this workflow automatically without waiting for a separate user request. Do not stage, commit, or push while the requested change is still in progress; do so only after the change is complete and applicable checks or tests have been run.

## Git worktrees for separate features

When working on separate or independent features, create a dedicated Git branch and worktree for each feature so the work remains isolated. Complete and test each feature in its own worktree.

After a feature or fix is complete and its applicable checks or tests pass:

1. Stage all changes in that worktree with `git add -A` and commit them with a concise, descriptive commit message.
2. Merge the completed worktree's branch into `main` without waiting for a separate user request.
3. Resolve any merge conflicts and rerun applicable checks or tests on the merged `main` branch.
4. Push the updated `main` branch to the remote repository.
5. Remove the completed worktree and delete its merged feature branch when it is safe to do so.

Do not merge a worktree branch before its requested feature or fix is complete and verified.
