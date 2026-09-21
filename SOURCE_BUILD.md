# Building from source

This archive holds the source for one Pigfox extension (in `extensions/<name>/`)
plus the shared workspace code it depends on (`packages/shared/`).

## Requirements

- Linux, macOS or Windows (WSL)
- Node.js 24.21.0
- pnpm 12.5.1 (`npm install -g pnpm@12.5.1`, or `corepack enable`)

## Steps

Run these from the directory this file is in:

```sh
pnpm install --frozen-lockfile
pnpm --filter "./extensions/*" exec wxt build -b firefox
```

The built Firefox extension is written to `extensions/<name>/.output/firefox-mv3/`.
