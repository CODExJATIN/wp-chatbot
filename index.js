const express = require("express");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const { GoogleAuth } = require("google-auth-library"); // 1. Import GoogleAuth
require("dotenv").config();

let isOnline = false;

// 2. Setup the Auth client outside the function
// This will automatically find and use your service-account-key.json file
// if you set the GOOGLE_APPLICATION_CREDENTIALS environment variable,
// or you can specify the path directly.
const auth = new GoogleAuth({
  keyFilename: "./service-account-key.json", // Path to your key file
  scopes: "https://www.googleapis.com/auth/generative-language",
});


// --- Gemini API Function (Updated with OAuth 2.0) ---
async function chatWithGemini(messages) {
  try {
    // 3. Get an OAuth2 access token
    const accessToken = await auth.getAccessToken();

    const chatHistory = messages
      .map((m) => `${m.fromMe ? "You" : "User"}: ${m.body}`)
      .join("\n");

// Place this inside your chatWithGemini function

const systemPrompt =`You are a helpful AI assistant for Jatin, handling his messages while he is offline. Your tone is friendly and professional.

Your goal is to answer questions on his behalf using ONLY the information provided below.

**Knowledge Base about Jatin:**
- **About:** He's a full-stack developer and an engineering undergraduate, passionate about building scalable web applications and creating impactful products.
- **Education:** He is pursuing a Bachelor of Engineering in Information Technology at L.D. College of Engineering (2022-2026).
- **Contact:** His email is helloitsmejatin@gmail.com.

If the user's question is personal, urgent, or about anything not covered in your knowledge base, you MUST reply with only this exact phrase: "Jatin will be right back to resolve your query."`;

    const finalPrompt = `${systemPrompt}\n\nConversation:\n${chatHistory}\n\nReply:`;

    // Note: The Gemini API endpoint may differ based on your project region.
    // The URL should include your GCP Project ID.
    // Example: "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1/publishers/google/models/gemini-1.5-flash:generateContent"
    // For this example, we'll stick to the simpler one you used.
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
      {
        contents: [{ parts: [{ text: finalPrompt }] }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          // 4. Use the generated access token as the Bearer token
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return (
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn’t think of a reply just now!"
    );
  } catch (err) {
    console.log(err);
    console.error("Gemini API error:", err.response?.data || err.message);
    return "Sorry, I’m having trouble connecting right now.";
  }
}


// --- WhatsApp Client (No changes needed here) ---
const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  console.log("📱 Scan this QR code with WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ WhatsApp bot connected and ready!");
});

const activeSessions = {}; // { chatId: true }

// Inside client.on("message")
client.on("message", async (msg) => {
  try {
    if (msg.from.includes("@g.us")) return; // ignore groups

    console.log(`💬 Message from ${msg.from}: ${msg.body}`);

    if (!isOnline) {
      const chatId = msg.from;

      // Check if this is a new session
      if (!activeSessions[chatId]) {
        const introMsg = `Hi! Jatin is currently offline. I'm his chat assistant 🤖. I can help answer some general questions or note your message so Jatin can reply later.`;
        await msg.reply(introMsg);
        activeSessions[chatId] = true; // mark session active
        console.log("📤 Sent fixed intro message");
        return; // skip AI reply for first message
      }

      // Fetch last 5 messages for context
      const chat = await msg.getChat();
      const messages = await chat.fetchMessages({ limit: 5 });

      // Generate AI reply
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


// --- Express API (No changes needed here) ---
const app = express();
app.use(express.json());

app.post("/toggle", (req, res) => {
  isOnline = !isOnline;
  console.log(`🔁 Bot status: ${isOnline ? "🟢 Online" : "🔴 Offline"}`);
  res.json({ status: isOnline ? "🟢 Online" : "🔴 Offline" });
});

app.get("/status", (req, res) => {
  res.json({ status: isOnline ? "🟢 Online" : "🔴 Offline" });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🌐 API running at http://localhost:${PORT}`));