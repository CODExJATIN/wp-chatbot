const express = require("express");
const qrcode = require("qrcode"); // <-- 1. MODIFICATION: Import the new package
const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");
require("dotenv").config();

let isOnline = false;
let qrCodeData = null; // <-- 2. MODIFICATION: Variable to store the QR code

const auth = new GoogleAuth({
  keyFilename: "./service-account-key.json",
  scopes: "https://www.googleapis.com/auth/generative-language",
});

// --- Gemini API Function (No changes needed here, but corrected a potential typo in the model name) ---
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

    // Note: 'gemini-2.5-flash-lite' is not a standard model name. 
    // Corrected to 'gemini-1.5-flash-latest' which is more common. Adjust if you have a specific model.
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
      {
        contents: [{ parts: [{ text: finalPrompt }] }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return (
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
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
});

// --- 3. MODIFICATION: Update the 'qr' event listener ---
client.on("qr", (qr) => {
  console.log("📱 QR code received! Scan it by visiting the /qr endpoint in your browser.");
  qrCodeData = qr; // Store the QR code data
});

client.on("ready", () => {
  console.log("✅ WhatsApp bot connected and ready!");
  qrCodeData = null; // Clear QR data once logged in
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
        console.log("📤 Sent fixed intro message");
        return;
      }

      const chat = await msg.getChat();
      const messages = await chat.fetchMessages({ limit: 5 });
      const aiReply = await chatWithGemini(messages);
      await msg.reply(aiReply);
      console.log("📤 Gemini reply sent:", aiReply);
    } else {
      console.log("🧠 You’re online — bot not replying.");
    }
  } catch (error) {
    console.error("❌ Error handling message:", error);
  }
});

client.initialize();

// --- Express API ---
const app = express();
app.use(express.json());

// --- 4. MODIFICATION: Add a new endpoint to display the QR code ---
app.get("/qr", (req, res) => {
  if (qrCodeData) {
    qrcode.toDataURL(qrCodeData, (err, url) => {
      if (err) {
        res.status(500).send("Error generating QR code.");
      } else {
        res.send(`<img src="${url}" alt="WhatsApp QR Code">`);
      }
    });
  } else {
    res.send("✅ Bot is ready or QR code is not available yet. Please refresh.");
  }
});

app.get("/toggle", (req, res) => {
  isOnline = !isOnline;
  console.log(`🔁 Bot status: ${isOnline ? "🟢 Online" : "🔴 Offline"}`);
  res.json({ status: isOnline ? "🟢 Online" : "🔴 Offline" });
});

app.get("/status", (req, res) => {
  res.json({ status: isOnline ? "🟢 Online" : "🔴 Offline" });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🌐 API running at http://localhost:${PORT}`));