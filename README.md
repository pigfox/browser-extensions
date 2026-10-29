# Pigfox Browser Extensions

Open-source browser extensions by Pigfox LLC. See https://pigfox.com.

- **Ghost Job Detector — by Pigfox**: flags stale, reposted, or unfilled job listings on job boards
- **JSON-LD Schema Inspector — by Pigfox**: reads and validates structured data on any page
- **DEX Swap Cost Checker — by Pigfox**: shows price impact and true cost of a swap on DEX pages
- **Contract Safety Check — by Pigfox**: quick facts on any 0x contract address on a page
- **Video Summary — by Pigfox** (working name): summarizes YouTube videos with Claude, using your own Anthropic API key; see [its README](extensions/video-summary/README.md)

No tracking, no accounts, no data collection. Video Summary sends a video's title and transcript to Anthropic, with your own key, to make the summary; nothing goes to Pigfox.

License: MIT

## Toolchain notes

TypeScript is held at 6.0.x because typescript-eslint 8.70 supports TypeScript below 6.1; upgrade both together.
