import * as webllm from "https://esm.run/@mlc-ai/web-llm";
import { marked } from "https://esm.run/marked@12";
import DOMPurify from "https://esm.run/dompurify@3";

// ---------- DOM ----------
const $ = (s) => document.querySelector(s);
const els = {
  sidebar: $("#sidebar"), backdrop: $("#backdrop"), chatList: $("#chatList"),
  newChat: $("#newChat"), openSidebar: $("#openSidebar"), closeSidebar: $("#closeSidebar"),
  openSettings: $("#openSettings"), clearAll: $("#clearAll"), exportChat: $("#exportChat"), themeBtn: $("#themeBtn"),
  modeSeg: $("#modeSeg"), modelSelect: $("#modelSelect"), loadBtn: $("#loadBtn"),
  status: $("#status"), statusText: $("#statusText"),
  progress: $("#progress"), progressBar: $("#progressBar"), progressText: $("#progressText"),
  messages: $("#messages"), composer: $("#composer"), input: $("#input"),
  sendBtn: $("#sendBtn"), stopBtn: $("#stopBtn"), hint: $("#hint"),
  dlg: $("#settingsDlg"), sClose: $("#sClose"), sSystem: $("#sSystem"), sTemp: $("#sTemp"),
  sTempVal: $("#sTempVal"), sTopP: $("#sTopP"), sTopPVal: $("#sTopPVal"), sMax: $("#sMax"),
  sReset: $("#sReset"), sSave: $("#sSave"), toastEl: $("#toast"),
};

// ---------- Config ----------
const MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 21V11a7.5 7.5 0 0 1 15 0v10"/><path d="M2.5 21h19"/><path d="M12 18.2c-1.6 0-2.8-1.1-2.8-2.6 0-1.8 1.7-2.4 2.1-4.4 1.5.9 3.5 2.5 3.5 4.6 0 1.4-1.2 2.4-2.8 2.4z" fill="currentColor" stroke="none"/></svg>';
const CURATED = [
  ["Llama-3.2-1B-Instruct-q4f16_1-MLC", "Llama 3.2 1B — fastest"],
  ["Qwen2.5-1.5B-Instruct-q4f16_1-MLC", "Qwen 2.5 1.5B — fast"],
  ["gemma-2-2b-it-q4f16_1-MLC", "Gemma 2 2B — balanced"],
  ["Llama-3.2-3B-Instruct-q4f16_1-MLC", "Llama 3.2 3B — smart"],
  ["Phi-3.5-mini-instruct-q4f16_1-MLC", "Phi 3.5 mini — reasoning"],
  ["Qwen2.5-7B-Instruct-q4f16_1-MLC", "Qwen 2.5 7B — strong (8GB+ GPU)"],
  ["Llama-3.1-8B-Instruct-q4f16_1-MLC", "Llama 3.1 8B — strongest (8GB+ GPU)"],
];
const SUGGESTIONS = [
  ["Explain something", "How do large language models actually work, in plain English?"],
  ["Write some code", "Write a Python function that checks if a string is a palindrome, with tests."],
  ["Plan a trip", "Create a relaxed 3-day itinerary for a first trip to Istanbul."],
  ["Help me write", "Draft a polite email asking my manager for a deadline extension."],
];
const DEFAULTS = {
  system: "You are Hearth, a thoughtful, warm and precise AI assistant. Give clear, well-structured answers and use Markdown (headings, lists, tables, code blocks) when it helps. If you are not sure about something, say so.",
  temperature: 0.7,
  top_p: 0.95,
  max_tokens: 1024,
  mode: "local",
  localModel: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
};
const LS_CHATS = "hearth.chats.v1";
const LS_SETTINGS = "hearth.settings.v1";
const LS_THEME = "hearth.theme";

// ---------- State (migrates data from the earlier "nova" build) ----------
const load = (k, legacy, d) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? JSON.parse(localStorage.getItem(legacy)) ?? d; } catch { return d; }
};
const state = {
  settings: { ...DEFAULTS, ...load(LS_SETTINGS, "nova.settings.v1", {}) },
  chats: load(LS_CHATS, "nova.chats.v1", []),
  activeId: null,
  engine: null,
  loadedModel: null,
  loading: false,
  generating: false,
  abort: null,
  stick: true,
  webgpu: false,
  f16: false,
  cloud: { enabled: false, model: "" },
};
if (/^You are Nova\b/.test(state.settings.system || "")) state.settings.system = DEFAULTS.system;
const saveChats = () => { try { localStorage.setItem(LS_CHATS, JSON.stringify(state.chats)); } catch { toast("Browser storage is full — delete some conversations."); } };
const saveSettings = () => localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const activeChat = () => state.chats.find((c) => c.id === state.activeId);

// ---------- Helpers ----------
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shortName = (id) => (id || "").replace(/-q\d+f\d+(_\d+)?-MLC.*$/, "").replace(/-MLC$/, "");
const sizeOf = (m) => (m?.vram_required_MB ? ` · ${(m.vram_required_MB / 1024).toFixed(1)} GB` : "");
const DOTS = '<span class="dots"><i></i><i></i><i></i></span>';

marked.setOptions({ gfm: true, breaks: true });
DOMPurify.addHook("afterSanitizeAttributes", (n) => {
  if (n.tagName === "A") { n.setAttribute("target", "_blank"); n.setAttribute("rel", "noopener noreferrer"); }
});
const md = (text) => DOMPurify.sanitize(marked.parse(text || ""));

function enhance(root) {
  root.querySelectorAll("pre code").forEach((code) => {
    if (window.hljs && !code.dataset.hl) { try { window.hljs.highlightElement(code); } catch {} code.dataset.hl = "1"; }
    const pre = code.parentElement;
    if (!pre.querySelector(".copy-code")) {
      const b = h("button", "copy-code", "copy");
      b.onclick = () => { navigator.clipboard.writeText(code.innerText); b.textContent = "copied"; setTimeout(() => (b.textContent = "copy"), 1200); };
      pre.append(b);
    }
  });
}

let toastTimer;
function toast(msg, ms = 3500) {
  els.toastEl.textContent = msg;
  els.toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toastEl.classList.remove("show"), ms);
}
function copy(text) { navigator.clipboard.writeText(text).then(() => toast("Copied to clipboard"), () => toast("Couldn't copy")); }

function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#171614" : "#f4f1ea");
  els.themeBtn.textContent = t === "dark" ? "☀" : "☾";
  els.themeBtn.title = t === "dark" ? "Switch to light" : "Switch to dark";
}

function setStatus(kind, text) { els.status.className = `status ${kind}`; els.statusText.textContent = text; els.status.title = text; }
function showProgress(p, text) {
  els.progress.hidden = false;
  els.progressBar.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
  els.progressText.textContent = text;
}
function hideProgress() { els.progress.hidden = true; els.progressBar.style.width = "0"; }

const nearBottom = () => { const m = els.messages; return m.scrollHeight - m.scrollTop - m.clientHeight < 140; };
const scrollBottom = (force) => { if (force || state.stick) els.messages.scrollTop = els.messages.scrollHeight; };

function autosize() {
  els.input.style.height = "auto";
  els.input.style.height = Math.min(els.input.scrollHeight, 200) + "px";
  els.sendBtn.disabled = !els.input.value.trim();
}

// ---------- Engine detection ----------
async function detectGPU() {
  try {
    if (!navigator.gpu) return;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    state.webgpu = true;
    state.f16 = adapter.features.has("shader-f16");
  } catch {}
}
async function detectCloud() {
  try {
    const r = await fetch("/api/config", { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    state.cloud = { enabled: !!j.cloud, model: j.model || "cloud model" };
  } catch {}
}

// ---------- Model select ----------
function buildModelOptions() {
  const sel = els.modelSelect;
  sel.innerHTML = "";
  if (state.settings.mode === "cloud") {
    sel.append(new Option(state.cloud.enabled ? state.cloud.model : "Cloud not configured", "cloud"));
    sel.disabled = true;
    return;
  }
  sel.disabled = state.generating || state.loading;
  const list = (webllm.prebuiltAppConfig?.model_list || []).filter((m) => !/embed/i.test(m.model_id) && m.model_type !== 1);
  const byId = new Map(list.map((m) => [m.model_id, m]));
  const fit = (id) => (state.webgpu && !state.f16 ? id.replace("q4f16_1", "q4f32_1") : id);

  const rec = document.createElement("optgroup");
  rec.label = "Recommended";
  for (const [id, label] of CURATED) {
    const mid = fit(id);
    const m = byId.get(mid);
    if (m) rec.append(new Option(`${label}${sizeOf(m)}`, mid));
  }
  const all = document.createElement("optgroup");
  all.label = "All models";
  for (const m of list) {
    if (state.webgpu && !state.f16 && /f16/.test(m.model_id)) continue;
    all.append(new Option(`${m.model_id}${sizeOf(m)}`, m.model_id));
  }
  if (rec.children.length) sel.append(rec);
  sel.append(all);

  let want = fit(state.settings.localModel);
  if (!byId.has(want)) want = rec.firstElementChild?.value || list[0]?.model_id;
  if (want) { sel.value = want; state.settings.localModel = want; }
}

function updateStatus() {
  if (state.loading) return;
  if (state.settings.mode === "cloud") {
    setStatus(state.cloud.enabled ? "ready" : "error", state.cloud.enabled ? `cloud · ${state.cloud.model}` : "cloud not configured");
    return;
  }
  if (!state.webgpu) { setStatus("error", "webgpu unavailable"); els.loadBtn.disabled = true; return; }
  const sel = els.modelSelect.value;
  if (state.loadedModel && state.loadedModel === sel) {
    setStatus("ready", `${shortName(sel)} · ready`);
    els.loadBtn.textContent = "Loaded";
    els.loadBtn.disabled = true;
  } else {
    setStatus("", state.loadedModel ? `loaded · ${shortName(state.loadedModel)}` : "no model loaded");
    els.loadBtn.textContent = state.loadedModel ? "Switch" : "Load";
    els.loadBtn.disabled = state.generating;
  }
}

function applyMode() {
  const mode = state.settings.mode;
  els.modeSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  els.modeSeg.querySelector('[data-mode="cloud"]').classList.toggle("unavailable", !state.cloud.enabled);
  buildModelOptions();
  els.loadBtn.hidden = mode === "cloud";
  els.hint.textContent = mode === "local"
    ? "Runs on your device · nothing you type leaves this browser · models can make mistakes"
    : `Cloud · ${state.cloud.model} · messages are sent to the server's model provider · models can make mistakes`;
  updateStatus();
  if (!activeChat()?.messages.length) renderMessages();
}

// ---------- Model loading ----------
async function loadModel(id) {
  if (!state.webgpu) { toast("This browser doesn't support WebGPU. Use Chrome/Edge 113+ on desktop, or switch to Cloud.", 6000); return false; }
  if (state.loading || !id) return false;
  state.loading = true;
  els.loadBtn.disabled = true;
  els.modelSelect.disabled = true;
  setStatus("loading", `loading ${shortName(id)}…`);
  showProgress(0, "Preparing…");
  const cb = (r) => showProgress(r.progress ?? 0, r.text || "");
  try {
    if (!state.engine) {
      const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
      state.engine = await webllm.CreateWebWorkerMLCEngine(worker, id, { initProgressCallback: cb });
    } else {
      state.engine.setInitProgressCallback?.(cb);
      await state.engine.reload(id);
    }
    state.loadedModel = id;
    toast(`${shortName(id)} is ready`);
    return true;
  } catch (err) {
    console.error(err);
    state.loadedModel = null;
    toast(`Couldn't load model: ${err?.message || err}`, 8000);
    return false;
  } finally {
    state.loading = false;
    hideProgress();
    els.modelSelect.disabled = state.generating;
    updateStatus();
    if (!activeChat()?.messages.length) renderMessages();
  }
}

async function ensureReady() {
  if (state.settings.mode === "cloud") {
    if (!state.cloud.enabled) { toast("Cloud mode isn't configured on this deployment."); return false; }
    return true;
  }
  const id = els.modelSelect.value;
  if (state.engine && state.loadedModel === id) return true;
  return loadModel(id);
}

// ---------- Rendering ----------
function bucket(ts) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400000;
  if (ts >= start) return "Today";
  if (ts >= start - day) return "Yesterday";
  if (ts >= start - 6 * day) return "This week";
  return "Earlier";
}

function renderSidebar() {
  els.chatList.innerHTML = "";
  const chats = [...state.chats].sort((a, b) => b.updated - a.updated);
  if (!chats.length) { els.chatList.append(h("div", "empty-list", "Nothing here yet.")); return; }
  let last = "";
  for (const c of chats) {
    const b = bucket(c.updated);
    if (b !== last) { els.chatList.append(h("div", "list-label", b)); last = b; }
    const item = h("div", `chat-item${c.id === state.activeId ? " active" : ""}`);
    item.dataset.id = c.id;
    item.title = c.title;
    const del = h("button", "del", "✕");
    del.title = "Delete conversation";
    del.dataset.del = c.id;
    item.append(h("span", "title", c.title), del);
    els.chatList.append(item);
  }
}

function welcomeEl() {
  const w = h("div", "welcome");
  const local = state.settings.mode === "local";
  const eyebrow = local
    ? (state.loadedModel ? `On device · ${shortName(state.loadedModel)}` : "On device · private by default")
    : `Cloud · ${state.cloud.model}`;
  w.innerHTML = `<div class="eyebrow">${esc(eyebrow)}</div><h1>What’s on <em>your</em> mind?</h1><p>${
    local
      ? "Hearth runs a real open-source language model <em>on your own machine</em>, right inside the browser. Nothing is sent to a server, it costs nothing, and it keeps working offline once a model is saved."
      : `You’re talking to <b>${esc(state.cloud.model)}</b> through the server.`
  }</p>`;
  if (local && !state.webgpu) {
    const n = h("div", "notice");
    n.innerHTML = `<b>This browser can’t run models locally (no WebGPU).</b><br>Try a recent Chrome or Edge on desktop or Android, or Safari 26+. ${
      state.cloud.enabled ? "Or switch to <b>Cloud</b> at the top." : "The site owner can also enable Cloud mode as a fallback."
    }`;
    w.append(n);
  } else if (local && !state.loadedModel && !state.loading) {
    w.append(h("div", "info", "Pick a model above and press Load — or just start typing. The first time, the model downloads once (0.7–5 GB); after that it opens in seconds."));
  }
  const g = h("div", "suggestions");
  for (const [t, p] of SUGGESTIONS) {
    const b = h("button", "suggestion");
    b.type = "button";
    const txt = h("span", "s-text");
    txt.append(h("b", null, t), h("span", null, p));
    b.append(txt, h("span", "arrow", "→"));
    b.onclick = () => send(p);
    g.append(b);
  }
  w.append(g);
  return w;
}

function messageEl(m, i, chat) {
  const wrap = h("div", `msg ${m.role}`);
  const content = h("div", "content");
  const bubble = h("div", "bubble");
  if (m.role === "user") bubble.textContent = m.content;
  else { bubble.innerHTML = m.content ? md(m.content) : DOTS; enhance(bubble); }
  content.append(bubble);

  const meta = h("div", "meta");
  const btn = (label, fn) => { const b = h("button", null, label); b.onclick = fn; return b; };
  if (m.content) meta.append(btn("Copy", () => copy(m.content)));
  if (m.role === "user") meta.append(btn("Edit", () => editFrom(i)));
  if (m.role === "assistant" && i === chat.messages.length - 1 && m.content) meta.append(btn("Retry", regenerate));
  if (m.stats) meta.append(h("span", "stats", m.stats));
  content.append(meta);

  if (m.role === "assistant") { const av = h("div", "avatar"); av.innerHTML = MARK; wrap.append(av); }
  wrap.append(content);
  return wrap;
}

function renderMessages(force = true) {
  const top = els.messages.scrollTop;
  const chat = activeChat();
  els.messages.innerHTML = "";
  if (!chat || !chat.messages.length) { els.messages.append(welcomeEl()); els.messages.scrollTop = 0; return; }
  chat.messages.forEach((m, i) => els.messages.append(messageEl(m, i, chat)));
  if (force || state.stick) scrollBottom(true);
  else els.messages.scrollTop = top;
}

// ---------- Chat logic ----------
function newChat() {
  const c = { id: uid(), title: "New conversation", messages: [], updated: Date.now() };
  state.chats.unshift(c);
  state.activeId = c.id;
  return c;
}

function buildPrompt(chat) {
  const local = state.settings.mode === "local";
  const budget = local ? 9000 : 48000; // characters of history to keep (fits small context windows)
  const past = chat.messages.slice(0, -1);
  const hist = [];
  let used = 0;
  for (let i = past.length - 1; i >= 0; i--) {
    used += past[i].content.length;
    if (used > budget && hist.length) break;
    hist.unshift({ role: past[i].role, content: past[i].content });
  }
  while (hist.length && hist[0].role !== "user") hist.shift();
  const system = state.settings.system || DEFAULTS.system;
  if (local && /^gemma/i.test(state.loadedModel || "") && hist.length) {
    hist[0] = { role: "user", content: `${system}\n\n${hist[0].content}` };
    return hist;
  }
  return [{ role: "system", content: system }, ...hist];
}

async function* localStream(messages) {
  const s = state.settings;
  const chunks = await state.engine.chat.completions.create({
    messages, stream: true, temperature: s.temperature, top_p: s.top_p, max_tokens: s.max_tokens,
  });
  for await (const c of chunks) {
    const d = c.choices?.[0]?.delta?.content;
    if (d) yield d;
  }
}

async function* cloudStream(messages) {
  const s = state.settings;
  state.abort = new AbortController();
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, temperature: s.temperature, top_p: s.top_p, max_tokens: s.max_tokens }),
    signal: state.abort.signal,
  });
  if (!res.ok || !res.body) {
    let t = await res.text().catch(() => "");
    try { t = JSON.parse(t).error || t; } catch {}
    throw new Error(t || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const j = JSON.parse(data);
        if (j.error) throw new Error(j.error.message || String(j.error));
        const d = j.choices?.[0]?.delta?.content;
        if (d) yield d;
      } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
    }
  }
}

function setGenerating(on) {
  state.generating = on;
  els.stopBtn.hidden = !on;
  els.sendBtn.hidden = on;
  els.modelSelect.disabled = on || state.settings.mode === "cloud";
  els.loadBtn.disabled = on;
  if (!on) { updateStatus(); autosize(); }
}

function stop() {
  if (!state.generating) return;
  if (state.settings.mode === "local") state.engine?.interruptGenerate();
  else state.abort?.abort();
}

async function generate(chat) {
  const reply = {
    role: "assistant",
    content: "",
    model: state.settings.mode === "cloud" ? state.cloud.model : shortName(state.loadedModel),
  };
  chat.messages.push(reply);
  chat.updated = Date.now();
  saveChats();
  renderSidebar();
  state.stick = true;
  renderMessages();
  const node = els.messages.lastElementChild;
  const bubble = node.querySelector(".bubble");
  bubble.classList.add("streaming");
  setGenerating(true);

  const prompt = buildPrompt(chat);
  let raf = 0, chunks = 0, t0 = 0;
  const paint = () => { raf = 0; bubble.innerHTML = md(reply.content); scrollBottom(); };
  try {
    const stream = state.settings.mode === "cloud" ? cloudStream(prompt) : localStream(prompt);
    for await (const delta of stream) {
      if (!t0) t0 = performance.now();
      reply.content += delta;
      chunks++;
      if (!raf) raf = requestAnimationFrame(paint);
    }
  } catch (err) {
    if (err?.name !== "AbortError") {
      console.error(err);
      reply.content += `${reply.content ? "\n\n" : ""}> **Error:** ${err?.message || err}`;
    }
  } finally {
    cancelAnimationFrame(raf);
    const secs = t0 ? (performance.now() - t0) / 1000 : 0;
    if (!reply.content.trim()) reply.content = "_(no response)_";
    reply.stats = `${reply.model}${chunks > 1 && secs > 0 ? ` · ${(chunks / secs).toFixed(1)} tok/s` : ""}`;
    chat.updated = Date.now();
    state.abort = null;
    setGenerating(false);
    saveChats();
    renderSidebar();
    if (activeChat() === chat) {
      node.replaceWith(messageEl(reply, chat.messages.length - 1, chat));
      scrollBottom();
    }
  }
}

async function send(text) {
  text = (text ?? els.input.value).trim();
  if (!text || state.generating || state.loading) return;
  if (!(await ensureReady())) return;
  let chat = activeChat();
  if (!chat) chat = newChat();
  chat.messages.push({ role: "user", content: text });
  if (chat.title === "New conversation" || chat.title === "New chat") chat.title = text.replace(/\s+/g, " ").slice(0, 60);
  if (els.input.value.trim() === text) { els.input.value = ""; autosize(); }
  await generate(chat);
}

async function regenerate() {
  if (state.generating || state.loading) return;
  const chat = activeChat();
  if (!chat) return;
  if (!(await ensureReady())) return;
  if (chat.messages.at(-1)?.role === "assistant") chat.messages.pop();
  if (chat.messages.at(-1)?.role !== "user") return;
  await generate(chat);
}

function editFrom(i) {
  if (state.generating) return;
  const chat = activeChat();
  if (!chat) return;
  const text = chat.messages[i].content;
  chat.messages = chat.messages.slice(0, i);
  saveChats();
  renderMessages();
  els.input.value = text;
  autosize();
  els.input.focus();
}

function exportChat() {
  const c = activeChat();
  if (!c?.messages.length) return toast("Nothing to export yet");
  const body = c.messages.map((m) => `**${m.role === "user" ? "You" : "Hearth"}:**\n\n${m.content}`).join("\n\n---\n\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([`# ${c.title}\n\n${body}\n`], { type: "text/markdown" }));
  a.download = `${c.title.replace(/[^\w\- ]+/g, "").trim().slice(0, 40) || "conversation"}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Sidebar / settings ----------
const openSidebar = () => { els.sidebar.classList.add("open"); els.backdrop.classList.add("show"); };
const closeSidebar = () => { els.sidebar.classList.remove("open"); els.backdrop.classList.remove("show"); };

function syncLabels() {
  els.sTempVal.textContent = Number(els.sTemp.value).toFixed(2);
  els.sTopPVal.textContent = Number(els.sTopP.value).toFixed(2);
}
function fillSettings(s) {
  els.sSystem.value = s.system; els.sTemp.value = s.temperature; els.sTopP.value = s.top_p; els.sMax.value = s.max_tokens; syncLabels();
}

// ---------- Events ----------
function bind() {
  els.composer.addEventListener("submit", (e) => { e.preventDefault(); send(); });
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  els.input.addEventListener("input", autosize);
  els.stopBtn.addEventListener("click", stop);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.generating) stop(); });
  els.messages.addEventListener("scroll", () => { state.stick = nearBottom(); }, { passive: true });

  els.themeBtn.addEventListener("click", () => {
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(LS_THEME, t); } catch {}
    applyTheme(t);
  });
  els.loadBtn.addEventListener("click", () => loadModel(els.modelSelect.value));
  els.modelSelect.addEventListener("change", () => {
    if (state.settings.mode !== "local") return;
    state.settings.localModel = els.modelSelect.value;
    saveSettings();
    updateStatus();
  });
  els.modeSeg.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-mode]");
    if (!b || state.generating || state.loading) return;
    if (b.dataset.mode === "cloud" && !state.cloud.enabled) {
      toast("Cloud isn't configured. Add LLM_API_KEY in Vercel → Settings → Environment Variables, then redeploy.", 7000);
      return;
    }
    state.settings.mode = b.dataset.mode;
    saveSettings();
    applyMode();
  });

  els.newChat.addEventListener("click", () => {
    if (state.generating) return toast("Wait for the reply to finish (or press Stop).");
    state.activeId = null;
    renderSidebar();
    renderMessages();
    closeSidebar();
    els.input.focus();
  });
  els.chatList.addEventListener("click", (e) => {
    if (state.generating) return toast("Wait for the reply to finish (or press Stop).");
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      const id = del.dataset.del;
      state.chats = state.chats.filter((c) => c.id !== id);
      if (state.activeId === id) state.activeId = null;
      saveChats();
      renderSidebar();
      renderMessages();
      return;
    }
    const item = e.target.closest(".chat-item");
    if (!item) return;
    state.activeId = item.dataset.id;
    renderSidebar();
    renderMessages();
    closeSidebar();
  });
  els.openSidebar.addEventListener("click", openSidebar);
  els.closeSidebar.addEventListener("click", closeSidebar);
  els.backdrop.addEventListener("click", closeSidebar);
  els.exportChat.addEventListener("click", exportChat);
  els.clearAll.addEventListener("click", () => {
    if (state.generating || !state.chats.length) return;
    if (!confirm("Delete all conversations? This cannot be undone.")) return;
    state.chats = [];
    state.activeId = null;
    saveChats();
    renderSidebar();
    renderMessages();
  });

  els.openSettings.addEventListener("click", () => { fillSettings(state.settings); els.dlg.showModal(); closeSidebar(); });
  els.sClose.addEventListener("click", () => els.dlg.close());
  els.sTemp.addEventListener("input", syncLabels);
  els.sTopP.addEventListener("input", syncLabels);
  els.sReset.addEventListener("click", () => fillSettings(DEFAULTS));
  els.sSave.addEventListener("click", () => {
    const s = state.settings;
    s.system = els.sSystem.value.trim() || DEFAULTS.system;
    s.temperature = Number(els.sTemp.value);
    s.top_p = Number(els.sTopP.value);
    s.max_tokens = Math.min(4096, Math.max(64, parseInt(els.sMax.value, 10) || DEFAULTS.max_tokens));
    saveSettings();
    els.dlg.close();
    toast("Settings saved");
  });
}

// ---------- Boot ----------
async function init() {
  applyTheme(document.documentElement.dataset.theme || "light");
  bind();
  renderSidebar();
  autosize();
  await Promise.all([detectGPU(), detectCloud()]);
  if (state.settings.mode === "cloud" && !state.cloud.enabled) state.settings.mode = "local";
  if (!state.webgpu && state.cloud.enabled) state.settings.mode = "cloud";
  applyMode();
  renderMessages();
  els.input.focus();
  // Auto-load the last model if it's already saved in this browser.
  if (state.settings.mode === "local" && state.webgpu) {
    try { if (await webllm.hasModelInCache(els.modelSelect.value)) loadModel(els.modelSelect.value); } catch {}
  }
}

init();
