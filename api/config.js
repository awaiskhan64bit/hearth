// Tells the frontend whether cloud mode is available (never exposes the key).
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    cloud: Boolean(process.env.LLM_API_KEY),
    model: process.env.LLM_MODEL || "llama-3.3-70b-versatile",
  });
}
