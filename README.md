# PageVoice Plus

A browser-based PDF reading prototype using Scribe.js for text extraction/OCR and the browser's SpeechSynthesis API for read-aloud. It is a new app, not a build of Readest. Readest is a separate complete reader app; this project borrows a clean reader-style workflow and uses Scribe.js as its extraction engine.

## What works in this prototype
- Choose a PDF from your device.
- Extract existing PDF text, or run English OCR with Scribe.js.
- Inspect and edit extracted text before reading.
- Read aloud with available system voices and speed control.
- Export corrected text as `.txt`.
- Search for relevant passages using keywords in the question.
- PDF processing occurs in the browser; the app does not upload the PDF to a backend.

## Important limitations
- The Q&A is keyword-based passage retrieval, not a generative AI answer engine, and does not track exactly which words were heard.
- Speech voices are provided by the browser/operating system. Available voices and offline behavior vary by device.
- A first visit needs internet to download the site. Fully offline OCR requires the app and Scribe.js assets plus its OCR language data to be hosted locally/same-origin and cached. This starter does not claim to be fully offline yet.
- Large PDFs can be slow on a phone. OCR can make mistakes; review the extracted text.
- Scribe.js is AGPL-3.0 licensed. If you host/modify/distribute this app, review the licence obligations and publish the corresponding source under compatible terms or obtain a commercial licence from the project owner.

## Run locally
Requires Node.js 20+.

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```
The generated static site is in `dist/`.

## Hosting on GitHub Pages
1. Upload the contents of this project (not the ZIP itself) to a GitHub repository.
2. In repository Settings → Pages, choose GitHub Actions as the deployment source.
3. Add a workflow that installs dependencies, runs `npm run build`, and publishes `dist/`. The included `vite.config.js` automatically sets the correct base path when built by the included GitHub Actions workflow.
4. Since GitHub Pages serves a public website, do not put private PDFs or secrets in the repository. PDFs are selected locally by each reader and are not part of the hosted files.

## Readest
Try the separate ready-made reader at https://web.readest.com/ . It is not embedded into this project.
