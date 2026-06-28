// src/server/proxy.js
// Simple Express proxy to forward Eleven Labs TTS requests without exposing API key

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load .env variables (ELEVENLABS_API_KEY)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "*" })); // Adjust origin in production
app.use(express.json({ limit: "1mb" }));

// POST /api/elevenlabs/speak
app.post("/api/elevenlabs/speak", async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Missing text" });
  }
  const voice = voiceId || "21m00Tcm4TlvDq8ikWAM";
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Eleven Labs API key not configured" });
  }
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.75, similarity_boost: 0.75 },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length,
    });
    res.send(buffer);
  } catch (e) {
    console.error("Eleven Labs proxy error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Eleven Labs proxy listening on http://localhost:${PORT}`);
});
