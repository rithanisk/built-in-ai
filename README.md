# Smart Reading Companion

A Chrome Manifest V3 extension that adds browser-native AI tools directly to online articles without requiring users to manage external API keys.

## Features

- Summarize an article.
- Translate selected or page text.
- Proofread writing in context.
- Ask questions about an article.
- Work with selected text and extracted page images where supported.

## Why it is different

The extension is designed around the browser's built-in Prompt API mode. That keeps the interaction close to the page and avoids routing article content through a separate application-level API key.

## Install locally

1. Clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the repository folder.
5. Open the extension options page and confirm the available built-in AI mode.

## Architecture

- `manifest.json` defines permissions, the popup, options page, and content script.
- `content.js` reads page context and renders in-page interactions.
- `background.js` coordinates browser events and model requests.
- `popup.*` contains the primary extension controls.
- `options.*` manages configuration and compatibility settings.

## Privacy and compatibility

- The extension requests access to the active page so it can read the content the user asks it to transform.
- Browser-native AI availability depends on the installed Chrome version, device support, and enabled experimental features.
- Multimodal behavior may vary by page and should be treated as experimental until broader end-to-end testing is complete.

## Stack

JavaScript, HTML, CSS, Chrome Manifest V3, Chrome extension APIs, and browser built-in AI APIs.

