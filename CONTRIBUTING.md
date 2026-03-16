# Contributing

Thanks for contributing to Whats The Backup.

## Before You Start

- Open an issue for significant feature work before starting implementation.
- Keep all sample archives, screenshots, and fixtures anonymized.
- Do not commit real WhatsApp exports, personal chat data, or secrets.

## Local Setup

```bash
pnpm install
pnpm dev:desktop
```

## Quality Checks

Run these before opening a pull request:

```bash
pnpm test
pnpm lint
pnpm build
```

## Pull Requests

- Keep PRs focused and easy to review.
- Update tests when behavior changes.
- Update docs when setup, behavior, or public messaging changes.
- Use English for code, UI copy, tests, docs, and commit-facing metadata.

## Privacy Expectations

This project works with private user exports. Contributors must avoid uploading real user archives, screenshots, or media to the repository, issues, or pull requests.
