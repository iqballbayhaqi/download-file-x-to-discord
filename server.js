require("dotenv").config();

const express = require("express");
const path = require("path");
const { parseTweetUrl } = require("./src/tweetParser");
const { fetchTweetMedia } = require("./src/fxTwitterService");
const { sendToDiscord } = require("./src/discordService");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Proxy endpoint for downloading media
app.get("/api/proxy", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("Missing URL parameter");
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "TwitterToDiscordBot/1.0",
      },
    });

    if (!response.ok) {
      return res.status(response.status).send("Failed to fetch media");
    }

    // Forward content-type
    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    // Determine filename
    let filename = "media";
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const basename = pathname.split("/").pop();
      if (basename) filename = basename;
    } catch (e) {
      // ignore
    }

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Stream the body
    // Node 18+ fetch returns a web stream, but Express needs a node stream.
    // If using 'undici' (global fetch in Node), response.body is a web ReadableStream.
    // To pipe to res (which is a Writable), we need to handle it.
    // The simplest way without extra deps in modern Node is:

    const reader = response.body.getReader();
    const stream = new (require("stream").Readable)({
      async read() {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          this.push(Buffer.from(value));
        }
      },
    });

    stream.pipe(res);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error");
  }
});

// API endpoint with SSE (Server-Sent Events)
app.get("/api/send", async (req, res) => {
  const { url, webhook, compress } = req.query;
  const allowCompression = compress !== "false"; // Default true

  if (!url) {
    return res.status(400).json({ error: "URL tweet harus diisi" });
  }

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  console.log(`\n🔗 Processing tweet: ${url}`);
  sendEvent({ status: "progress", percent: 5, message: "Memulai proses..." });

  // 1. Parse tweet URL
  const parsed = parseTweetUrl(url);
  if (parsed.error) {
    console.log(`❌ Parse error: ${parsed.error}`);
    sendEvent({ status: "error", message: parsed.error });
    return res.end();
  }

  console.log(`👤 User: @${parsed.username} | Tweet ID: ${parsed.tweetId}`);

  try {
    // 2. Fetch tweet data from FxTwitter API
    console.log("📡 Fetching tweet data from FxTwitter...");
    sendEvent({
      status: "progress",
      percent: 10,
      message: "Mengambil data tweet...",
    });

    const tweetData = await fetchTweetMedia(parsed.username, parsed.tweetId);

    if (tweetData.media.length === 0) {
      console.log("⚠️  No media found in tweet");
      sendEvent({
        status: "error",
        message: "Tidak ada media (gambar/video) di tweet ini",
      });
      return res.end();
    }

    console.log(`📎 Found ${tweetData.media.length} media file(s)`);

    // 3. Download & send to Discord
    console.log("🚀 Sending to Discord...");
    if (!allowCompression) console.log("⚠️ Compression disabled by user");

    const results = await sendToDiscord(
      tweetData.media,
      url,
      tweetData.text,
      tweetData.author,
      tweetData.authorHandle,
      (percent, message) => {
        sendEvent({ status: "progress", percent, message });
      },
      webhook, // Pass dynamic webhook URL
      allowCompression,
    );

    console.log("✅ Done! Media sent to Discord successfully.\n");

    sendEvent({
      status: "success",
      message: `Berhasil mengirim ${tweetData.media.length} media ke Discord!`,
      tweet: {
        author: tweetData.author,
        authorHandle: tweetData.authorHandle,
        text: tweetData.text,
        mediaCount: tweetData.media.length,
        mediaTypes: tweetData.media.map((m) => m.type),
        media: tweetData.media, // Send media URLs to frontend
      },
      discord: results,
    });

    res.end();
  } catch (error) {
    console.error("❌ Error:", error.message);
    sendEvent({ status: "error", message: error.message });
    res.end();
  }
});

// Start server
app.listen(PORT, () => {
  console.log(
    `\n🚀 Twitter/X to Discord Bot running at http://localhost:${PORT}`,
  );
  console.log(
    `📋 Webhook: ${process.env.DISCORD_WEBHOOK_URL ? "✅ Configured (Env)" : "⚠️  Not set in Env (Use UI to configure)"}\n`,
  );
});
