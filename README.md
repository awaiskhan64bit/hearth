# ✦ Nova Chat

A polished, ChatGPT-style web app that runs **real open-source large language models directly in your browser** — no server GPU, no API key, no data leaving your device.

Powered by [WebLLM](https://github.com/mlc-ai/web-llm) (MLC) on **WebGPU**, with an optional **Cloud mode** that streams from any OpenAI-compatible API (Groq, OpenAI, OpenRouter, Together…).

## Features

- 🧠 **Real LLMs, locally** — Llama 3.2 (1B/3B), Llama 3.1 8B, Qwen 2.5 (1.5B/7B), Gemma 2 2B, Phi 3.5 mini, plus every other WebLLM prebuilt model
- ⚡ **Token streaming** with live Markdown rendering, syntax-highlighted code blocks and one-click copy
- 🧵 Inference runs in a **Web Worker**, so the UI stays smooth
- 💾 **Multiple conversations** saved in your browser (localStorage), grouped by date
- ✏️ Edit & resend, ↻ regenerate, ■ stop (or press `Esc`), export chat to Markdown
- ⚙️ Settings: system prompt, temperature, top-p, max tokens
- 📦 Models download once and are **cached** — later visits auto-load in seconds, even offline
- ☁️ **Cloud fallback** for browsers without WebGPU (key stays server-side)
- 📱 Responsive, dark UI that works on desktop and mobile

## Requirements (Local mode)

A browser with WebGPU: Chrome / Edge 113+ (desktop, Android), or Safari 26+. Small models (1–2B) need ~1–2 GB of GPU memory; 7–8B models need ~5–6 GB.

## Enable Cloud mode (optional)

In **Vercel → Project → Settings → Environment Variables** add:

| Variable | Required | Default |
|---|---|---|
| `LLM_API_KEY` | ✅ | — (e.g. free key from https://console.groq.com/keys) |
| `LLM_BASE_URL` | | `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | | `llama-3.3-70b-versatile` |

Then redeploy. Examples: OpenAI → `LLM_BASE_URL=https://api.openai.com/v1`, `LLM_MODEL=gpt-4o-mini`; OpenRouter → `https://openrouter.ai/api/v1`.

## Project structure

```
index.html      UI shell
styles.css      styling
app.js          app logic (chats, streaming, rendering, model management)
worker.js       WebLLM engine running in a Web Worker
api/chat.js     optional streaming proxy to an OpenAI-compatible API (Vercel function)
api/config.js   reports whether cloud mode is configured
```

No build step — it's plain ES modules.

## Run locally

```bash
npx serve .        # local mode only
npx vercel dev     # local + cloud API routes
```

## Deploy

Import the repo in Vercel (framework preset: **Other**) — that's it. Every push to `main` redeploys.
