// Optional cloud mode: streams chat completions from any OpenAI-compatible API.
// Configure in Vercel → Project → Settings → Environment Variables:
//   LLM_API_KEY  (required)  e.g. a free Groq key from https://console.groq.com/keys
//   LLM_BASE_URL (optional)  default https://api.groq.com/openai/v1
//   LLM_MODEL    (optional)  default llama-3.3-70b-versatile

export const config = { maxDuration: 60 };

const clamp = (v, min, max, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const key = process.env.LLM_API_KEY;
  if (!key) {
    return res.status(501).json({ error: "Cloud mode is not configured. Set LLM_API_KEY in your Vercel project settings." });
  }
  const base = (process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
  const model = process.env.LLM_MODEL || "llama-3.3-70b-versatile";

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const messages = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => m && ["system", "user", "assistant"].includes(m.role) && typeof m.content === "string")
    .slice(-50)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 32000) }));
  if (!messages.length) return res.status(400).json({ error: "`messages` is required" });

  let upstream;
  try {
    upstream = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: clamp(body.temperature, 0, 2, 0.7),
        top_p: clamp(body.top_p, 0, 1, 0.95),
        max_tokens: Math.round(clamp(body.max_tokens, 16, 4096, 1024)),
      }),
    });
  } catch (e) {
    return res.status(502).json({ error: `Could not reach LLM provider: ${e.message}` });
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return res.status(upstream.status || 502).json({ error: `LLM provider error ${upstream.status}: ${text.slice(0, 500)}` });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const reader = upstream.body.getReader();
  req.on("close", () => { reader.cancel().catch(() => {}); });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch {
    // client disconnected or upstream aborted
  } finally {
    res.end();
  }
}
