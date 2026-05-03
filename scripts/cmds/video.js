"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

try {
  require.resolve("@distube/ytdl-core");
} catch {
  console.log("[VideoBot] Installing @distube/ytdl-core...");
  execSync("npm install @distube/ytdl-core --save", { stdio: "inherit" });
}
const ytdl = require("@distube/ytdl-core");

const pendingMP3 = new Map();

const PLATFORM_PATTERNS = {
  youtube:
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  facebook:
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:facebook\.com|fb\.watch)\/(?:watch\/?\?v=\d+|[^/]+\/videos\/\d+|reel\/\d+|stories\/|video\.php\?v=\d+|\S+)/i,
  instagram:
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i,
  tiktok:
    /(?:https?:\/\/)?(?:www\.|vm\.)?tiktok\.com\/(?:@[^/]+\/video\/\d+|v\/\d+|[a-zA-Z0-9]+\/?)/i,
};

function detectPlatform(url) {
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(url)) return platform;
  }
  return null;
}

function extractURL(text) {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

const TEMP_DIR = path.join(__dirname, "..", "..", "tmp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function getTempPath(ext = "mp4") {
  return path.join(TEMP_DIR, `goatbot_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
}

function cleanup(...paths) {
  for (const p of paths) {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  }
}

async function downloadYouTubeVideo(url) {
  const info = await ytdl.getInfo(url);
  const title = info.videoDetails.title.replace(/[^\w\s\-]/gi, "").trim();
  const duration = parseInt(info.videoDetails.lengthSeconds);

  if (duration > 600) {
    throw new Error(`Video অনেক লম্বা (${Math.floor(duration / 60)} মিনিট)! সর্বোচ্চ 10 মিনিট।`);
  }

  let format;
  try {
    format = ytdl.chooseFormat(info.formats, {
      filter: (f) =>
        f.hasVideo && f.hasAudio && f.container === "mp4" &&
        (!f.contentLength || parseInt(f.contentLength) < 52428800),
      quality: "highestvideo",
    });
  } catch {
    format = ytdl.chooseFormat(info.formats, {
      filter: "audioandvideo",
      quality: "lowestvideo",
    });
  }

  const tempPath = getTempPath("mp4");
  await new Promise((resolve, reject) => {
    ytdl(url, { format })
      .pipe(fs.createWriteStream(tempPath))
      .on("finish", resolve)
      .on("error", reject);
  });

  return { path: tempPath, title, duration };
}

async function downloadYouTubeAudio(url) {
  const info = await ytdl.getInfo(url);
  const title = info.videoDetails.title.replace(/[^\w\s\-]/gi, "").trim();

  const format = ytdl.chooseFormat(info.formats, {
    filter: "audioonly",
    quality: "highestaudio",
  });

  const tempPath = getTempPath("mp3");
  await new Promise((resolve, reject) => {
    ytdl(url, { format })
      .pipe(fs.createWriteStream(tempPath))
      .on("finish", resolve)
      .on("error", reject);
  });

  return { path: tempPath, title };
}

async function downloadViaCobalt(url, platform) {
  const response = await axios.post(
    "https://api.cobalt.tools/api/json",
    { url, vCodec: "h264", vQuality: "720", aFormat: "mp3", isAudioOnly: false },
    {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      timeout: 30000,
    }
  );

  const { status, url: dlUrl, urls, picker } = response.data;
  let directUrl = null;

  if (["redirect", "stream", "tunnel"].includes(status)) {
    directUrl = dlUrl;
  } else if (status === "picker" && picker?.length > 0) {
    directUrl = (picker.find((p) => p.type === "video") || picker[0]).url;
  } else if (status === "success") {
    directUrl = dlUrl || urls?.[0];
  } else {
    throw new Error(`Cobalt: ${status} — ${response.data.text || "Unknown"}`);
  }

  if (!directUrl) throw new Error("Download URL পাওয়া গেল না।");

  const tempPath = getTempPath("mp4");
  const fileRes = await axios({
    method: "GET",
    url: directUrl,
    responseType: "stream",
    timeout: 120000,
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36" },
    maxContentLength: 80 * 1024 * 1024,
  });

  await new Promise((resolve, reject) => {
    fileRes.data.pipe(fs.createWriteStream(tempPath)).on("finish", resolve).on("error", reject);
  });

  return { path: tempPath, title: `${platform} Video`, platform };
}

async function downloadTikTokFallback(url) {
  const response = await axios.post(
    "https://snaptik.app/abc2.php",
    `url=${encodeURIComponent(url)}`,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Linux; Android 11) Chrome/90.0.4430.91 Mobile Safari/537.36",
        Referer: "https://snaptik.app/",
      },
      timeout: 20000,
    }
  );
  const match = response.data.match(/href="(https:\/\/[^"]*?\.mp4[^"]*?)"/);
  if (!match) throw new Error("TikTok MP4 URL পাওয়া গেল না।");

  const tempPath = getTempPath("mp4");
  const fileRes = await axios({
    method: "GET",
    url: match[1].replace(/&amp;/g, "&"),
    responseType: "stream",
    timeout: 120000,
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  await new Promise((resolve, reject) => {
    fileRes.data.pipe(fs.createWriteStream(tempPath)).on("finish", resolve).on("error", reject);
  });

  return { path: tempPath, title: "TikTok Video", platform: "TikTok" };
}

async function downloadVideo(url) {
  const platform = detectPlatform(url);
  if (!platform) throw new Error("Unsupported platform");

  switch (platform) {
    case "youtube":  return { ...(await downloadYouTubeVideo(url)), platform: "YouTube" };
    case "facebook": return await downloadViaCobalt(url, "Facebook");
    case "instagram":return await downloadViaCobalt(url, "Instagram");
    case "tiktok":
      try { return await downloadViaCobalt(url, "TikTok"); }
      catch { return await downloadTikTokFallback(url); }
    default: throw new Error("Unsupported");
  }
}


const EMOJI = {
  youtube: "▶️ YouTube",
  facebook: "📘 Facebook",
  instagram: "📷 Instagram",
  tiktok: "🎵 TikTok",
};

async function handleDownload(api, event, message, url) {
  const { senderID } = event;
  const platform = detectPlatform(url);
  if (!platform) return;

  const waitMsg = await message.reply(
    `🤖 ${EMOJI[platform]} link পেয়েছি!\n⏳ Download হচ্ছে... একটু অপেক্ষা করো 🙏`
  );

  let tempPath = null;

  try {
    const result = await downloadVideo(url);
    tempPath = result.path;
    const sizeMB = (fs.statSync(tempPath).size / 1048576).toFixed(2);

    api.unsendMessage(waitMsg.messageID).catch(() => {});

    let body =
      `✅ ${EMOJI[platform]}\n` +
      `📹 ${result.title}\n` +
      `📦 Size: ${sizeMB} MB`;

    // YouTube → tell user they can reply "mp3"
    if (platform === "youtube") {
      body += `\n\n🎵 MP3 চাইলে এই message এ reply করে লেখো: mp3`;
    }

    // Send video
    const sentMsg = await message.reply({
      body,
      attachment: fs.createReadStream(tempPath),
    });

    if (platform === "youtube" && sentMsg?.messageID) {
      pendingMP3.set(sentMsg.messageID, {
        url,
        title: result.title,
        senderID,
      });

      setTimeout(() => pendingMP3.delete(sentMsg.messageID), 5 * 60 * 1000);
    }
  } catch (err) {
    api.unsendMessage(waitMsg.messageID).catch(() => {});
    console.error("[VideoBot]", err.message);
    message.reply(
      `❌ Download হয়নি!\n\n${err.message}\n\n💡 Public link দাও, private video কাজ করবে না।`
    );
  } finally {
    cleanup(tempPath);
  }
}

module.exports = {
  config: {
    name: "video",
    aliases: ["vid", "dl", "download"],
    version: "3.0.0",
    author: "MOSTAKIM",
    countDown: 10,
    role: 0,
    shortDescription: "Video download + YouTube MP3 option",
    longDescription:
      "Link দিলে video পাঠাবে। YouTube হলে reply করে 'mp3' লিখলে MP3 ও পাঠাবে!\n" +
      "Supported: YouTube, Facebook, Instagram, TikTok",
    category: "media",
    guide: {
      en:
        "{pn} <video link>\n\n" +
        "YouTube:\n  {pn} https://youtu.be/xxxxx\n" +
        "  → Video আসবে, তারপর reply দিয়ে 'mp3' লিখলে MP3 পাবে!\n\n" +
        "অথবা সরাসরি link paste করো — bot auto-detect করবে।",
    },
  },


  onStart: async function ({ api, event, args, message }) {
    const url = extractURL(args.join(" "));

    if (!url) {
      return message.reply(
        "🔗 একটা link দাও!\n\n" +
        "📌 Supported:\n▶️ YouTube\n📘 Facebook\n📷 Instagram\n🎵 TikTok\n\n" +
        "Usage: video <link>"
      );
    }

    if (!detectPlatform(url)) {
      return message.reply("❌ এই link support করে না!");
    }

    await handleDownload(api, event, message, url);
  },


  onChat: async function ({ api, event, message }) {
    const { body, messageReply, senderID } = event;
    if (!body) return;

    if (messageReply?.messageID && pendingMP3.has(messageReply.messageID)) {
      const keyword = body.trim().toLowerCase();

      if (["mp3", "audio", "music", "গান", "অডিও"].includes(keyword)) {
        const pending = pendingMP3.get(messageReply.messageID);

        if (pending.senderID !== senderID) {
          return message.reply("❌ এই option শুধু original requester এর জন্য!");
        }

        pendingMP3.delete(messageReply.messageID);

        const waitMsg = await message.reply("🎵 MP3 download হচ্ছে... ⏳");
        let mp3Path = null;

        try {
          const result = await downloadYouTubeAudio(pending.url);
          mp3Path = result.path;
          const sizeMB = (fs.statSync(mp3Path).size / 1048576).toFixed(2);

          api.unsendMessage(waitMsg.messageID).catch(() => {});

          await message.reply({
            body: `✅ MP3 Ready!\n🎵 ${result.title}\n📦 Size: ${sizeMB} MB`,
            attachment: fs.createReadStream(mp3Path),
          });
        } catch (err) {
          api.unsendMessage(waitMsg.messageID).catch(() => {});
          message.reply(`❌ MP3 download হয়নি!\n${err.message}`);
        } finally {
          cleanup(mp3Path);
        }

        return; 
      }
    }

    const url = extractURL(body);
    if (!url) return;

    const platform = detectPlatform(url);
    if (!platform) return;

    // Skip if message has too much extra text
    const extra = body.replace(url, "").trim();
    if (extra.length > 30) return;

    await handleDownload(api, event, message, url);
  },
};