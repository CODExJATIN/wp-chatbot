const express = require("express");
const qrcode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");
const puppeteer = require("puppeteer-core");
const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");
require("dotenv").config();

let isOnline = false;
let qrCodeData = null;

const auth = new GoogleAuth({
  keyFilename: "./service-account-key.json",
  scopes: "https://www.googleapis.com/auth/generative-language",
});

// --- Gemini API Function ---
async function chatWithGemini(messages) {
  try {
    const accessToken = await auth.getAccessToken();
    const chatHistory = messages
      .map((m) => `${m.fromMe ? "You" : "User"}: ${m.body}`)
      .join("\n");

    const systemPrompt = `You are a helpful AI assistant for Jatin, handling his messages while he is offline. Your tone is friendly and professional.

Your goal is to answer questions on his behalf using ONLY the information provided below.

**Knowledge Base about Jatin:**
- **About:** He's a full-stack developer and an engineering undergraduate, passionate about building scalable web applications and creating impactful products.
- **Education:** He is pursuing a Bachelor of Engineering in Information Technology at L.D. College of Engineering (2022-2026).
- **Contact:** His email is helloitsmejatin@gmail.com.

If the user's question is personal, urgent, or about anything not covered in your knowledge base, you MUST reply with only this exact phrase: "Jatin will be right back to resolve your query."`;

    const finalPrompt = `${systemPrompt}\n\nConversation:\n${chatHistory}\n\nReply:`;

    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
      {
        input: [
          {
            role: "user",
            content: [{ type: "text", text: finalPrompt }],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return (
      response.data?.candidates?.[0]?.content?.[0]?.text ||
      "Sorry, I couldn’t think of a reply just now!"
    );
  } catch (err) {
    console.error("Gemini API error:", err.response?.data || err.message);
    return "Sorry, I’m having trouble connecting right now.";
  }
}

// --- WhatsApp Client ---
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome-stable",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  },
});

client.on("qr", (qr) => {
  console.log("📱 QR code received! Visit /qr to scan.");
  qrCodeData = qr;
});

client.on("ready", () => {
  console.log("✅ WhatsApp bot connected!");
  qrCodeData = null;
});

const activeSessions = {};

client.on("message", async (msg) => {
  try {
    if (msg.from.includes("@g.us")) return;

    console.log(`💬 Message from ${msg.from}: ${msg.body}`);

    if (!isOnline) {
      const chatId = msg.from;

      if (!activeSessions[chatId]) {
        const introMsg = `Hi! Jatin is currently offline. I'm his chat assistant 🤖. I can help answer some general questions or note your message so Jatin can reply later.`;
        await msg.reply(introMsg);
        activeSessions[chatId] = true;
        return;
      }

      const chat = await msg.getChat();
      const messages = await chat.fetchMessages({ limit: 5 });
      const aiReply = await chatWithGemini(messages);
      await msg.reply(aiReply);
    }
  } catch (error) {
    console.error("❌ Error handling message:", error);
  }
});

client.initialize();

// --- Express API ---
const app = express();
app.use(express.json());

app.get("/qr", async (req, res) => {
  if (qrCodeData) {
    try {
      const url = await qrcode.toDataURL(qrCodeData);
      res.send(`<img src="${url}" alt="WhatsApp QR Code">`);
    } catch (err) {
      res.status(500).send("Error generating QR code.");
    }
  } else {
    res.send("✅ Bot is ready or QR code not available yet. Refresh the page.");
  }
});

app.get("/toggle", (req, res) => {
  isOnline = !isOnline;
  res.json({ status: isOnline ? "🟢 Online" : "🔴 Offline" });
});

app.get("/status", (req, res) => {
  res.json({ status: isOnline ? "🟢 Online" : "🔴 Offline" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 API running at http://localhost:${PORT}`));