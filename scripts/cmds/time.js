"use strict";

const { createCanvas } = require("canvas");
const fs               = require("fs");
const path             = require("path");

module.exports = {
        config: {
                name: "time",
                aliases: ["clock", "টাইম", "সময়"],
                version: "1.0",
                author: "MOSTAKIM",
                countDown: 3,
                role: 0,
                shortDescription: "Real-time clock with dashboard",
                longDescription: "Shows live time, date, day with Bangladesh timezone, then sends a dashboard image.",
                category: "system",
                guide: {
                        en: "{pn}"
                }
        },

        onStart: async function ({ api, event, usersData, threadsData, commandsData }) {
                const threadID = event.threadID;

                const TIMEZONE = "Asia/Dhaka";
                const now = new Date();

                const fmtOpt = (opts) =>
                        new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, ...opts }).format(now);

                const hours   = fmtOpt({ hour: "2-digit", hour12: false });
                const minutes = fmtOpt({ minute: "2-digit" });
                const seconds = fmtOpt({ second: "2-digit" });
                const day     = fmtOpt({ day: "2-digit" });
                const month   = fmtOpt({ month: "long" });
                const year    = fmtOpt({ year: "numeric" });
                const dayName = fmtOpt({ weekday: "long" });

                const ampm = parseInt(hours, 10) >= 12 ? "PM" : "AM";
                const h12  = String(parseInt(hours, 10) % 12 || 12).padStart(2, "0");

                // ── First message: text ──────────────────────────────────────────────
                const timeMsg =
                        `🕐 𝗥𝗲𝗮𝗹-𝗧𝗶𝗺𝗲 𝗖𝗹𝗼𝗰𝗸\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `⏰ Time    : ${hours} hours, ${minutes} minutes, ${seconds} seconds\n` +
                        `🕛 12H     : ${h12}:${minutes}:${seconds} ${ampm}\n` +
                        `📅 Date    : ${day} - ${month}, ${year}\n` +
                        `📆 Day     : ${dayName}\n` +
                        `🌏 Timezone: Asia/Dhaka (UTC+6)\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━`;

                await api.sendMessage(timeMsg, threadID);

                // ── Second message: dashboard image ──────────────────────────────────
                setTimeout(async () => {
                        const imgPath = buildDashboard({
                                hours, minutes, seconds,
                                h12, ampm,
                                day, month, year, dayName,
                        });

                        await api.sendMessage(
                                { attachment: fs.createReadStream(imgPath) },
                                threadID,
                                () => { try { fs.unlinkSync(imgPath); } catch {} }
                        );
                }, 1000);
        },
};

// ── Canvas Dashboard ─────────────────────────────────────────────────────────
function buildDashboard({ hours, minutes, seconds, h12, ampm, day, month, year, dayName }) {
        const W = 820, H = 380;
        const canvas = createCanvas(W, H);
        const ctx    = canvas.getContext("2d");

        // Background
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0,   "#03071a");
        bg.addColorStop(0.5, "#050c1e");
        bg.addColorStop(1,   "#060b19");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Radial glow
        const rg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 400);
        rg.addColorStop(0, "rgba(0,200,255,0.06)");
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);

        // Grid dots
        ctx.fillStyle = "rgba(0,180,255,0.04)";
        for (let gx = 20; gx < W; gx += 28)
                for (let gy = 20; gy < H; gy += 28) {
                        ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI * 2); ctx.fill();
                }

        // Scanlines
        for (let y = 0; y < H; y += 4) {
                ctx.fillStyle = "rgba(0,0,0,0.05)";
                ctx.fillRect(0, y, W, 2);
        }

        // ── Title bar ────────────────────────────────────────────────────────────
        const tbg = ctx.createLinearGradient(0, 0, W, 0);
        tbg.addColorStop(0, "rgba(0,255,180,0.13)");
        tbg.addColorStop(1, "rgba(0,60,200,0.06)");
        ctx.fillStyle = tbg;
        ctx.fillRect(0, 0, W, 52);
        ctx.strokeStyle = "rgba(0,255,180,0.20)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 52); ctx.lineTo(W, 52); ctx.stroke();

        // Traffic dots
        ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
                ctx.beginPath(); ctx.arc(22 + i * 22, 26, 7, 0, Math.PI * 2);
                ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 12;
                ctx.fill(); ctx.shadowBlur = 0;
        });

        // Title
        ctx.font = "bold 18px monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("🕐  REAL-TIME CLOCK DASHBOARD", 82, 33);

        // Online badge
        ctx.fillStyle = "rgba(0,255,100,0.12)";
        roundRect(ctx, W - 150, 14, 98, 24, 12); ctx.fill();
        ctx.strokeStyle = "rgba(0,255,100,0.30)";
        ctx.lineWidth = 1;
        roundRect(ctx, W - 150, 14, 98, 24, 12); ctx.stroke();
        ctx.beginPath(); ctx.arc(W - 137, 26, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#00ff66"; ctx.shadowColor = "#00ff66"; ctx.shadowBlur = 14;
        ctx.fill(); ctx.shadowBlur = 0;
        ctx.font = "bold 11px monospace"; ctx.fillStyle = "#00ff66";
        ctx.fillText("ONLINE", W - 129, 31);

        // ── Big clock display ─────────────────────────────────────────────────────
        const clockStr = `${hours}:${minutes}:${seconds}`;
        ctx.font = "bold 72px monospace";
        ctx.fillStyle = "#00ffcc";
        ctx.shadowColor = "#00ffcc"; ctx.shadowBlur = 28;
        const cw = ctx.measureText(clockStr).width;
        ctx.fillText(clockStr, (W - cw) / 2, 145);
        ctx.shadowBlur = 0;

        // AM/PM
        ctx.font = "bold 20px monospace";
        ctx.fillStyle = "#00ffaa";
        ctx.fillText(ampm, (W + cw) / 2 + 12, 120);

        // 12H small
        ctx.font = "14px monospace";
        ctx.fillStyle = "#445577";
        const sub12 = `12H: ${h12}:${minutes}:${seconds} ${ampm}`;
        const sw = ctx.measureText(sub12).width;
        ctx.fillText(sub12, (W - sw) / 2, 165);

        // ── Info cards ────────────────────────────────────────────────────────────
        const cards = [
                { label: "DATE",     value: `${day} ${month} ${year}`, color: "#4499ff", glow: "#4499ff" },
                { label: "DAY",      value: dayName,                   color: "#cc66ff", glow: "#cc66ff" },
                { label: "TIMEZONE", value: "Asia/Dhaka",              color: "#00ffaa", glow: "#00ffaa" },
                { label: "UTC",      value: "UTC + 6",                 color: "#ffaa00", glow: "#ffaa00" },
        ];

        const cardW = 182, cardH = 72, cardY = 185, gap = 14;
        const totalW = cards.length * cardW + (cards.length - 1) * gap;
        const startX = (W - totalW) / 2;

        cards.forEach((c, i) => {
                const x = startX + i * (cardW + gap);
                ctx.fillStyle = "rgba(255,255,255,0.03)";
                roundRect(ctx, x, cardY, cardW, cardH, 10); ctx.fill();
                ctx.strokeStyle = c.glow + "44"; ctx.lineWidth = 1;
                roundRect(ctx, x, cardY, cardW, cardH, 10); ctx.stroke();

                // top accent
                ctx.strokeStyle = c.glow + "66"; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(x + 10, cardY); ctx.lineTo(x + 50, cardY); ctx.stroke();

                ctx.font = "9px monospace"; ctx.fillStyle = "#556677";
                ctx.fillText(c.label, x + 12, cardY + 18);

                ctx.font = "bold 16px monospace";
                ctx.fillStyle = c.color; ctx.shadowColor = c.glow; ctx.shadowBlur = 10;
                ctx.fillText(c.value, x + 12, cardY + 48); ctx.shadowBlur = 0;
        });

        // ── Footer ────────────────────────────────────────────────────────────────
        ctx.fillStyle = "rgba(0,255,170,0.07)";
        ctx.fillRect(0, H - 30, W, 30);
        ctx.strokeStyle = "rgba(0,255,180,0.12)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, H - 30); ctx.lineTo(W, H - 30); ctx.stroke();

        ctx.font = "11px monospace";
        ctx.fillStyle = "#00ffaa"; ctx.shadowColor = "#00ffaa"; ctx.shadowBlur = 8;
        ctx.fillText("● LIVE", 16, H - 10); ctx.shadowBlur = 0;

        ctx.fillStyle = "#334455";
        ctx.fillText(`NODE ${process.version}  •  PID ${process.pid}`, 70, H - 10);

        const copy = `MOSTAKIM GOAT BOT © ${year}`;
        ctx.fillStyle = "#2a3a4a";
        ctx.fillText(copy, W - 16 - ctx.measureText(copy).width, H - 10);

        const outPath = path.join(process.cwd(), `time_dash_${Date.now()}.png`);
        fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
        return outPath;
}

function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
}