    title    = (info.title || "Video").slice(0, 80);
    platform = info.extractor_key || platform;
    duration = info.duration || 0;
  } catch {}

  const formatStr = isPinterest
    ? "best/bestvideo+bestaudio"
    : "bestvideo[ext=mp4][filesize<50M]+bestaudio[ext=m4a]/best[ext=mp4][filesize<50M]/best/worst";

  const args = [
    url, "-o", out,
    "--no-playlist",
    "--merge-output-format", "mp4",
    "-f", formatStr,
    "--geo-bypass",
    "--retries", "3",
    "--max-filesize", "80m",
    "--remux-video", "mp4",
    "--quiet", "--no-warnings",
    "--add-header", "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124 Safari/537.36",
    ...platformArgs
  ];

  await runYtdlp(args);

  if (!fs.existsSync(out) || fs.statSync(out).size < 10000) {
    const base  = path.basename(out, ".mp4");
    const found = fs.readdirSync(TMP).find(f => f.startsWith(base));
    if (found) return { file: path.join(TMP, found), title, platform, duration };
    throw new Error("Output file not found after download");
  }

  return { file: out, title, platform, duration };
}

module.exports = {
  config: {
    name: "autodl",
    version: "1.4",
    author: "MOSTAKIM",
    countDown: 3,
    role: 0,
    shortDescription: "Auto Video Downloader",
    longDescription: "TikTok, Facebook, Instagram, Pinterest",
    category: "media",
    guide: "{pn} <link>"
  },

  onLoad: async function () {
    try { await ensureReady(); }
    catch (e) { console.error("[autodl]", e.message); }
  },

  onStart: async function ({ api, event, args, message }) {
    const url = (args[0] || "").trim();
    if (!url) return message.reply("⚠️ Please provide a link!");
    if (!getPlatform(url)) return message.reply("❌ Unsupported!\nSupported: TikTok, Facebook, Instagram, Pinterest");
    await this.handleDownload(url, api, event, message);
  },

  onChat: async function ({ api, event, message }) {
    const { body, senderID } = event;
    if (!body) return;
    try { if (senderID === api.getCurrentUserID()) return; } catch {}
    const match = body.match(/(https?:\/\/[^\s]+)/i);
    if (!match) return;
    const url = match[1].replace(/[).,!?]+$/, "");
    if (!getPlatform(url)) return;
    if (body.replace(url, "").trim().length > 20) return;
    await this.handleDownload(url, api, event, message);
  },

  handleDownload: async function (url, api, event, message) {
    const { messageID } = event;
    const start = Date.now();

    try { api.setMessageReaction("☢️", messageID, () => {}, true); } catch {}

    try { await ensureReady(); }
    catch (e) {
      try { api.setMessageReaction("❌", messageID, () => {}, true); } catch {}
      return message.reply("❌ " + e.message);
    }

    let filePath = null;
    try {
      const result = await download(url);
      filePath = result.file;

      const dlTime = formatDLTime(Date.now() - start);
      const sizeMB = (fs.statSync(filePath).size / 1048576).toFixed(2);
      const dur    = formatDuration(result.duration);

      await message.reply({
        body:
          `『𝐀𝐔𝐓𝐎 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑』\n\n` +
          `📃 𝗧𝗶𝘁𝗹𝗲: ${result.title}\n` +
          `🕐 𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻: ${dur}\n\n` +
          `🌐 𝗣𝗹𝗮𝘁𝗳𝗼𝗿𝗺: ${result.platform}\n` +
          `📦 𝗦𝗶𝘇𝗲: ${sizeMB} MB\n` +
          `⏳ 𝗗𝗟 𝗧𝗶𝗺𝗲: ${dlTime}\n` +
          `🤖 𝗕𝗢𝗧: 𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐆𝐎𝐀𝐓 𝐁𝐎𝐓`,
        attachment: fs.createReadStream(filePath)
      });

      try { api.setMessageReaction("✅", messageID, () => {}, true); } catch {}

    } catch (err) {
      try { api.setMessageReaction("❌", messageID, () => {}, true); } catch {}
      message.reply("❌ " + err.message);
    } finally {
      cleanup(filePath);
    }
  }
};
