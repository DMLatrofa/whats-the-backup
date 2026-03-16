# Whats The Backup

## Download

Download the latest Windows build from [GitHub Releases](https://github.com/DMLatrofa/whats-the-backup/releases).

Whats The Backup is a desktop-first app for browsing WhatsApp export archives as a familiar chat timeline. It parses local `.zip` exports, lets you search messages, and previews attachments without uploading data to a server.

## Highlights

- Local-first parsing of WhatsApp export `.zip` files
- Conversation list with date ranges and participant summaries
- Message and author search
- Inline previews for images, video, audio, and documents
- Desktop persistence for the last selected backup folder

## Privacy

- Processing happens locally on your machine.
- Backup archives are not uploaded to an external server.
- The default `backup/` workspace folder is Git-ignored.
- Before publishing the repository publicly, keep screenshots and test fixtures anonymized.

## Trademark Disclaimer

Whats The Backup is an independent project and is not affiliated with, endorsed by, or sponsored by WhatsApp or Meta. WhatsApp is a trademark of Meta.

## Repository Layout

- `apps/desktop`: Tauri + React desktop application
- `packages/parser`: parser and message summarization utilities
- `backup/`: local-only folder for exported archives during development

## Requirements

- Node.js 22+
- pnpm 10+
- Rust toolchain with `cargo`

## Getting Started

```bash
pnpm install
pnpm dev:desktop
```

## Local Backup Flow

1. Export a WhatsApp chat as a `.zip` archive.
2. Place the archive in your local `backup/` folder, or choose another folder from inside the desktop app.
3. Start the desktop app.
4. Click `Scan backups`.
5. Open a conversation from the sidebar.

## Development Commands

```bash
pnpm install
pnpm dev
pnpm dev:desktop
pnpm test
pnpm lint
pnpm build
pnpm build:desktop
```

## Release Notes

- CI runs type checks and tests on pull requests and pushes.
- Desktop release automation targets Windows first.
- Add only sanitized screenshots and demo materials to public releases.

## Contributing

Please read `CONTRIBUTING.md` before opening a pull request.

## Support

Bug reports and feature requests belong in GitHub Issues. Security-sensitive reports should follow `SECURITY.md`.
