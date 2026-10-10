# Hearth

*A private AI that lives in your browser.* — **Live: https://hearth-llm.vercel.app**

Hearth is a chat app that runs **real open-source language models on your own device** — no server GPU, no API key, nothing you type leaves the browser. It's powered by [WebLLM](https://github.com/mlc-ai/web-llm) on **WebGPU**, with an optional **Cloud** mode that streams from any OpenAI-compatible API (Groq, OpenAI, OpenRouter, Together…).

## Features

- **Real models, on device** — Llama 3.2 (1B/3B), Llama 3.1 8B, Qwen 2.5 (1.5B/7B), Gemma 2 2B, Phi 3.5 mini, plus every other WebLLM prebuilt model
- **Streaming replies** with Markdown, syntax-highlighted code and one-click copy
- Inference in a **Web Worker** so the interface never stutters
- **Conversations saved locally**, grouped by date
- Edit & resend, retry, stop (`Esc`), export to Markdown
- Settings: system prompt, temperature, top-p, max tokens
- **Light & dark themes** (follows your OS, toggle in the top bar)
- Models download once and are **cached** — later visits load in seconds, even offline
- **Cloud fallback** for browsers without WebGPU (key stays server-side)

## Requirements (on-device mode)

Chrome / Edge 113+ (desktop, Android) or Safari 26+. Small models (1–2B) need ~1–2 GB of GPU memory; 7–8B models need ~5–6 GB.

## Enable Cloud mode (optional)

In **Vercel → Project → Settings → Environment Variables**:

| Variable | Required | Default |
|---|---|---|
| `LLM_API_KEY` | yes | — (e.g. free key from https://console.groq.com/keys) |
| `LLM_BASE_URL` | | `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | | `llama-3.3-70b-versatile` |

Redeploy afterwards. OpenAI: `LLM_BASE_URL=https://api.openai.com/v1`, `LLM_MODEL=gpt-4o-mini`. OpenRouter: `https://openrouter.ai/api/v1`.

## Structure

```
index.html      UI shell
styles.css      design system (light + dark)
app.js          app logic: conversations, streaming, rendering, model management
worker.js       WebLLM engine in a Web Worker
api/chat.js     optional streaming proxy to an OpenAI-compatible API
api/config.js   reports whether cloud mode is configured
```

No build step — plain ES modules.

## Run locally

```bash
npx serve .        # on-device mode only
npx vercel dev     # plus cloud API routes
```
