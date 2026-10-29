# Video Summary — by Pigfox

Working name; the store name is not final.

On a YouTube video page, click the extension to get:

- a one-paragraph TL;DR;
- key points, each with a timestamp that jumps the video there;
- a Skip list of filler (intros, sponsor reads, repetition, outro), each range jumping past itself;
- an estimate of the time skipping saves.

Summaries are made by Claude through the Anthropic API with your own API key.
Claude Haiku 5.5 is the default; Claude Sonnet 5.5 can be picked in Options.
Each summary is saved per video in the browser, so reopening the popup costs
nothing; **Re-summarize** asks Claude again.

## Install (load unpacked)

```sh
pnpm install
pnpm --filter video-summary build
```

- **Chrome:** open `chrome://extensions`, turn on **Developer mode**, click
  **Load unpacked** and pick `extensions/video-summary/.output/chrome-mv3/`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, click **Load
  Temporary Add-on** and pick `extensions/video-summary/.output/firefox-mv3/manifest.json`.

## Set the API key

1. Create a key at [console.anthropic.com](https://console.anthropic.com).
2. Open the extension's options: click the extension, then **Options** (or
   right-click its icon → **Options**).
3. Paste the key into **Anthropic API key** and click **Save key**.

The key is kept only in the extension's local storage (`chrome.storage.local`)
in that browser profile and is sent only to `api.anthropic.com`. It is never in
this repository, a `.env` file or the build, and the options page never shows
it again once saved. **Remove key** deletes it.

## How it gets the transcript

1. The caption track from the page's player response (English first, otherwise
   auto-generated), fetched as `fmt=json3`.
2. If that fails, the transcript panel, when it is open on the page (under the
   description, **Show transcript**).
3. With neither, the popup says "No transcript available for this video" and
   no API call is made.

Transcripts longer than about 100,000 characters are summarized in parts and
then merged into one summary.

## Data

The video's title and transcript are sent to Anthropic to make the summary.
Nothing is sent to Pigfox.

```sh
pnpm build   # Chrome + Firefox, output in .output/
pnpm zip     # store-ready zips in .output/
```
