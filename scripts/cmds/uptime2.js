"use strict";
const { execSync }     = require("child_process");
const os               = require("os");
const { createCanvas } = require("canvas");
const fs               = require("fs");
const path             = require("path");

module.exports = {
  config: {
    name            : "uptime2",
    aliases         : ["upt", "botuptime"],
    category        : "system",
    shortDescription: "Bot uptime & system dashboard",
    longDescription : "Shows live stats as text then sends a dashboard image.",
    guide           : "{pn}uptime",
    countDown       : 5,
    role            : 0,
    author          : "MOSTAKIM",
  },

  onStart: async function ({ api, event, usersData, threadsData, commandsData }) {
    const startTime = Date.now();
    const threadID  = event.threadID;

    let botNick = "";
    try {
      const botUID     = api.getCurrentUserID();
      const threadInfo = await api.getThreadInfo(threadID);

      const nickMap =
        threadInfo?.nicknames                       ||  // path 1
        threadInfo?.customization?.nicknames        ||  // path 2
        threadInfo?.threadCustomization?.nicknames  ||  // path 3
        {};

      botNick = nickMap[botUID] || "";
    } catch {}

    if (!botNick) {
      try {
        const cfgPath = path.join(process.cwd(), "config.json");
        if (fs.existsSync(cfgPath)) {
          const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
          botNick = raw.nickName || raw.botName || raw.name || "";
        }
      } catch {}
    }

    if (!botNick) {
      try {
        const cfg = global.GoatBot?.config;
        if (cfg) botNick = cfg.nickName || cfg.botName || cfg.name || "";
      } catch {}
    }

    if (!botNick) {
      try {
        const botUID  = api.getCurrentUserID();
        const botInfo = await api.getUserInfo(botUID);
        botNick = botInfo?.[botUID]?.name || botInfo?.[botUID]?.firstName || "";
      } catch {}
    }

    if (!botNick) botNick = "𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐆𝐎𝐀𝐓 𝐁𝐎𝐓";

    const s    = getSnapshot();
    const disk = getDisk();

    const uptimeSec = Math.floor(process.uptime());
    const d  = Math.floor(uptimeSec / 86400);
    const h  = Math.floor((uptimeSec % 86400) / 3600);
    const m  = Math.floor((uptimeSec % 3600)  / 60);
    const sc = uptimeSec % 60;
    const uptimeStr = `${d}d ${h}h ${m}m ${sc}s`;

    const ping = Date.now() - startTime;

    let userCount = 0, groupCount = 0, cmdCount = 0, evtCount = 0;
    try { userCount  = (await usersData.getAll()).length;  } catch {}
    try { groupCount = (await threadsData.getAll()).length; } catch {}
    try { cmdCount   = global.GoatBot?.commands?.size || commandsData?.size || 0; } catch {}
    try { evtCount   = global.GoatBot?.onEvent?.size  || 0; } catch {}

    const nodeVer  = process.version;
    const platform = `${os.platform()} ${os.arch()}`.toUpperCase();

    const txt =
`╔══════════════════════╗
  ⚙️ - 𝐔𝐏𝐓𝐈𝐌𝐄  𝐒𝐓𝐀𝐓𝐔𝐒
╚══════════════════════╝
⏳ Uptime  : ${uptimeStr}
📶 Ping    : ${ping} ms
💾 Memory  : ${s.usedMemMB} MB
⚡ CPU     : ${s.cpu}%

╔══════════════════════╗
  🤖 - 𝐁𝐎𝐓 𝐈𝐍𝐅𝐎
╚══════════════════════╝
👥 Users    : ${userCount}
💬 Groups   : ${groupCount}
🧩 Commands : ${cmdCount}
🔔 Events   : ${evtCount}

╔══════════════════════╗
  🌐 - 𝐄𝐍𝐕𝐈𝐑𝐎𝐍𝐌𝐄𝐍𝐓
╚══════════════════════╝
📦 Node     : ${nodeVer}
💻 Platform : ${platform}
🗄️  Disk     : ${disk.str}`;

    await api.sendMessage(txt, threadID);

    const imgPath = buildDashboard({
      botNick,
      cpu       : parseFloat(s.cpu),
      mem       : parseFloat(s.memPct),
      usedMemMB : s.usedMemMB,
      totalMemGB: s.totalMemGB,
      diskPct   : disk.pct,
      diskStr   : disk.str,
      uptimeStr,
      ping,
      userCount,
      groupCount,
      cmdCount,
      evtCount,
      nodeVer,
      platform,
    });

    await api.sendMessage(
      { attachment: fs.createReadStream(imgPath) },
      threadID,
      () => { try { fs.unlinkSync(imgPath); } catch {} }
    );
  },
};


function getSnapshot() {
  const total = os.totalmem();
  const free  = os.freemem();
  const used  = total - free;
  const cpu   = Math.min(99, ((os.loadavg()[0] / os.cpus().length) * 100)).toFixed(1);
  return {
    cpu,
    memPct    : ((used / total) * 100).toFixed(1),
    usedMemMB : (used  / 1024 / 1024).toFixed(0),
    totalMemGB: (total / 1024 / 1024 / 1024).toFixed(1),
  };
}

function getDisk() {
  try {
    const out   = execSync("df / | tail -1").toString().trim().split(/\s+/);
    const used  = parseInt(out[2]);
    const total = parseInt(out[1]);
    const pct   = Math.round((used / total) * 100);
    const toGB  = v => (v / 1024 / 1024).toFixed(1);
    return { str: `${toGB(used)}GB / ${toGB(total)}GB (${pct}%)`, pct };
  } catch {
    return { str: "N/A", pct: 0 };
  }
}

function buildDashboard(info) {
  const W = 820, H = 450;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   "#03071a");
  bg.addColorStop(0.5, "#050c1e");
  bg.addColorStop(1,   "#060b19");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // radial glow center
  const rg = ctx.createRadialGradient(W/2, H/2, 40, W/2, H/2, 420);
  rg.addColorStop(0, "rgba(0,255,180,0.05)");
  rg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

  // grid dots
  ctx.fillStyle = "rgba(0,180,255,0.035)";
  for (let gx = 20; gx < W; gx += 28)
    for (let gy = 20; gy < H; gy += 28) {
      ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI*2); ctx.fill();
    }


  for (let y = 0; y < H; y += 4) {
    ctx.fillStyle = "rgba(0,0,0,0.055)";
    ctx.fillRect(0, y, W, 2);
  }

  const tbg = ctx.createLinearGradient(0, 0, W, 0);
  tbg.addColorStop(0, "rgba(0,255,180,0.13)");
  tbg.addColorStop(1, "rgba(0,60,200,0.06)");
  ctx.fillStyle = tbg; ctx.fillRect(0, 0, W, 52);
  ctx.strokeStyle = "rgba(0,255,180,0.20)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,52); ctx.lineTo(W,52); ctx.stroke();

  // traffic dots
  ["#ff5f57","#febc2e","#28c840"].forEach((c, i) => {
    ctx.beginPath(); ctx.arc(22+i*22, 26, 7, 0, Math.PI*2);
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 12;
    ctx.fill(); ctx.shadowBlur = 0;
  });

 
  const displayName = "🤖 " + info.botNick;
  ctx.font = "bold 18px monospace"; ctx.fillStyle = "#ffffff";
  ctx.fillText(displayName, 82, 33);


  const nw = ctx.measureText(displayName).width;
  ctx.fillStyle = "rgba(0,255,170,0.18)";
  roundRect(ctx, 86+nw, 13, 52, 22, 7); ctx.fill();
  ctx.font = "bold 11px monospace"; ctx.fillStyle = "#00ffaa";
  ctx.fillText("v2", 94+nw, 28);


  ctx.fillStyle = "rgba(0,255,100,0.12)";
  roundRect(ctx, W-150, 14, 98, 24, 12); ctx.fill();
  ctx.strokeStyle = "rgba(0,255,100,0.30)";
  ctx.lineWidth = 1; roundRect(ctx, W-150, 14, 98, 24, 12); ctx.stroke();
  ctx.beginPath(); ctx.arc(W-137, 26, 5, 0, Math.PI*2);
  ctx.fillStyle = "#00ff66"; ctx.shadowColor = "#00ff66"; ctx.shadowBlur = 14;
  ctx.fill(); ctx.shadowBlur = 0;
  ctx.font = "bold 11px monospace"; ctx.fillStyle = "#00ff66";
  ctx.fillText("ONLINE", W-129, 31);


  ctx.font = "12px monospace"; ctx.fillStyle = "#445566";
  ctx.fillText(new Date().toTimeString().slice(0,8), W-46, 31);


  const cards = [
    {
      label : "CPU USAGE",
      val   : `${info.cpu}%`,
      sub   : `${os.cpus().length} Cores`,
      color : "#00ffaa",
      glow  : "#00ffaa",
    },
    {
      label : "MEMORY",
      val   : `${(info.usedMemMB/1024).toFixed(1)}GB`,
      sub   : `${(info.usedMemMB/1024).toFixed(1)} / ${info.totalMemGB} GB`,
      color : "#cc66ff",
      glow  : "#cc66ff",
    },
    {
      label : "DISK USAGE",
      val   : `${info.diskPct}%`,
      sub   : "System Drive",
      color : "#ff4466",
      glow  : "#ff4466",
      hi    : true,
    },
    {
      label : "UPTIME",
      val   : info.uptimeStr.split(" ").slice(0,2).join(" "),
      sub   : info.uptimeStr,
      color : "#ffffff",
      glow  : "#4499ff",
    },
  ];

  cards.forEach((c, i) => {
    const x=14+i*199, y=62, cw=189, ch=78;
    ctx.fillStyle = c.hi
      ? "rgba(255,40,70,0.10)"
      : "rgba(255,255,255,0.035)";
    roundRect(ctx, x, y, cw, ch, 11); ctx.fill();
    ctx.strokeStyle = c.hi
      ? "rgba(255,60,80,0.45)"
      : "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1; roundRect(ctx, x, y, cw, ch, 11); ctx.stroke();

    // top accent line
    ctx.strokeStyle = c.glow + "55"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x+11,y); ctx.lineTo(x+55,y); ctx.stroke();

    // glow dot
    ctx.beginPath(); ctx.arc(x+15, y+16, 5, 0, Math.PI*2);
    ctx.fillStyle = c.glow; ctx.shadowColor = c.glow; ctx.shadowBlur = 14;
    ctx.fill(); ctx.shadowBlur = 0;

    ctx.font = "9px monospace"; ctx.fillStyle = "#7788aa";
    ctx.fillText(c.label, x+26, y+20);

    ctx.font = "bold 26px monospace"; ctx.fillStyle = c.color;
    ctx.shadowColor = c.glow; ctx.shadowBlur = 14;
    ctx.fillText(c.val, x+10, y+54); ctx.shadowBlur = 0;

    ctx.font = "9px monospace"; ctx.fillStyle = "#556677";
    ctx.fillText(c.sub, x+10, y+70);
  });

  [
    { label:"CPU",    val:info.cpu,     color:"#00ffaa", x:95,  cy:205 },
    { label:"MEMORY", val:info.mem,     color:"#cc66ff", x:245, cy:205 },
    { label:"DISK",   val:info.diskPct, color:"#ff4466", x:390, cy:205 },
  ].forEach(g => drawDonut(ctx, g.x, g.cy, 50, 34, g.val/100, g.color, g.label, `${g.val}%`));

  const pX=450, pY=155, pW=356, pH=135;
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  roundRect(ctx, pX, pY, pW, pH, 10); ctx.fill();
  ctx.strokeStyle = "rgba(0,255,180,0.08)";
  ctx.lineWidth = 1; roundRect(ctx, pX, pY, pW, pH, 10); ctx.stroke();

  ctx.font = "bold 10px monospace"; ctx.fillStyle = "#00ffaa";
  ctx.fillText("◈ SYSTEM INFO", pX+12, pY+18);

  const rows = [
    ["NODE.JS",  info.nodeVer],
    ["PLATFORM", info.platform],
    ["HOSTNAME", os.hostname().slice(0,20)],
    ["USERS",    ""+info.userCount],
    ["GROUPS",   ""+info.groupCount],
    ["PID",      ""+process.pid],
  ];
  rows.forEach(([k,v], i) => {
    const ry = pY+34+i*17;
    ctx.font = "9px monospace"; ctx.fillStyle = "#445566";
    ctx.fillText(k, pX+12, ry);
    ctx.fillStyle = "#00aaff";
    ctx.fillText(v, pX+pW-14-ctx.measureText(v).width, ry);
    if (i < rows.length-1) {
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(pX+12, ry+3, pW-24, 1);
    }
  });

  const mY=305, mH=110;
  ctx.fillStyle = "rgba(255,255,255,0.02)";
  roundRect(ctx, 14, mY, W-28, mH, 10); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1; roundRect(ctx, 14, mY, W-28, mH, 10); ctx.stroke();

  ctx.font = "bold 10px monospace"; ctx.fillStyle = "#8899bb";
  ctx.fillText("▶ LIVE RESOURCE MONITOR", 28, mY+18);

  [
    ["#00ffaa", `CPU ${info.cpu}%`],
    ["#cc66ff", `MEM ${info.mem}%`],
    ["#ff4466", `DISK ${info.diskPct}%`],
  ].forEach(([c,l], i) => {
    const lx = W-265+i*90;
    ctx.beginPath(); ctx.arc(lx, mY+13, 4, 0, Math.PI*2);
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 7;
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.font = "9px monospace"; ctx.fillStyle = c;
    ctx.fillText(l, lx+8, mY+17);
  });

  const wY = mY+28, wH = mH-42;
  drawStaticWave(ctx, 28, wY, W-56, wH, info.cpu/100,     "#00ffaa", 0);
  drawStaticWave(ctx, 28, wY, W-56, wH, info.mem/100,     "#cc66ff", 1.5);
  drawStaticWave(ctx, 28, wY, W-56, wH, info.diskPct/100, "#ff4466", 3.0);

  const fg = ctx.createLinearGradient(0, H-30, W, H);
  fg.addColorStop(0, "rgba(0,255,170,0.09)");
  fg.addColorStop(1, "rgba(0,60,180,0.05)");
  ctx.fillStyle = fg; ctx.fillRect(0, H-30, W, 30);
  ctx.strokeStyle = "rgba(0,255,180,0.12)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,H-30); ctx.lineTo(W,H-30); ctx.stroke();

  ctx.font = "11px monospace";
  ctx.fillStyle = "#00ffaa"; ctx.shadowColor = "#00ffaa"; ctx.shadowBlur = 8;
  ctx.fillText("● READY", 16, H-10); ctx.shadowBlur = 0;

  ctx.fillStyle = "#334455";
  ctx.fillText(`LINUX • NODE ${info.nodeVer} • PID ${process.pid}`, 90, H-10);

  const footLabel = `${info.botNick} © ${new Date().getFullYear()}`;
  ctx.fillStyle = "#2a3a4a";
  ctx.fillText(footLabel, W-16-ctx.measureText(footLabel).width, H-10);

  const outPath = path.join(process.cwd(), `dash_${Date.now()}.png`);
  fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
  return outPath;
}

function drawDonut(ctx, cx, cy, outer, inner, pct, color, label, text) {
  // track ring
  ctx.beginPath();
  ctx.arc(cx, cy, outer, 0, Math.PI*2);
  ctx.arc(cx, cy, inner, Math.PI*2, 0, true);
  ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fill();


  ctx.beginPath(); ctx.arc(cx, cy, outer+3, 0, Math.PI*2);
  ctx.strokeStyle = color + "55"; ctx.lineWidth = 2;
  ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;


  const start = -Math.PI / 2;
  const end   = start + pct * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, outer, start, end);
  ctx.arc(cx, cy, inner, end, start, true);
  ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 22;
  ctx.fill(); ctx.shadowBlur = 0;

  ctx.font = "bold 14px monospace"; ctx.fillStyle = color;
  ctx.textAlign = "center"; ctx.shadowColor = color; ctx.shadowBlur = 10;
  ctx.fillText(text, cx, cy+5); ctx.shadowBlur = 0;

  ctx.font = "9px monospace"; ctx.fillStyle = "#8899bb";
  ctx.fillText(label, cx, cy+outer+15);
  ctx.textAlign = "left";
}

function drawStaticWave(ctx, x, y, w, h, amplitude, color, phase) {
  const pts = 120;

  ctx.beginPath(); ctx.moveTo(x, y+h);
  for (let i = 0; i <= pts; i++) {
    const px   = x + (i/pts)*w;
    const wave = Math.sin(i*0.15 + phase)*(h*amplitude*0.35)
               + Math.sin(i*0.07 + phase*1.7)*(h*amplitude*0.15);
    const py   = y + h - h*amplitude*0.5 - wave;
    i === 0 ? ctx.lineTo(px,py) : ctx.lineTo(px,py);
  }
  ctx.lineTo(x+w, y+h); ctx.closePath();
  ctx.fillStyle = color + "20"; ctx.fill();

  // stroke line
  ctx.beginPath();
  for (let i = 0; i <= pts; i++) {
    const px   = x + (i/pts)*w;
    const wave = Math.sin(i*0.15 + phase)*(h*amplitude*0.35)
               + Math.sin(i*0.07 + phase*1.7)*(h*amplitude*0.15);
    const py   = y + h - h*amplitude*0.5 - wave;
    i === 0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
  }
  ctx.strokeStyle = color; ctx.lineWidth = 1.8;
  ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y, x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h, x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h, x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y, x+r,y);
  ctx.closePath();
}