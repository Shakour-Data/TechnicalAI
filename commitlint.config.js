name: Commit Message
on:
  commit_message:
    branches: [main]

commit_message:
  pattern: '^(feat|fix|docs|style|refactor|test|chore|build|ci|revert): .+'
  help: |
    Commit messages must follow Conventional Commits format.
    Examples:
      feat: add user authentication
      fix: resolve memory leak in ta-engine
      docs: update README installation instructions