const chalk = require('chalk');

module.exports.config = {
    name: "autoreact",
    version: "4.1.0",
    hasPermssion: 0,
    credits: "MOSTAKIM",
    description: "Auto React ON/OFF - Dynamic Prefix",
    commandCategory: "No Prefix",
    cooldowns: 0,
    usePrefix: false
};

if (!global.autoreactStatus) global.autoreactStatus = {};

module.exports.onChat = async function ({ api, event }) {
    const { threadID, messageID, senderID, body } = event;

    if (senderID == api.getCurrentUserID() ||!body) return;

    const prefix = global.config?.PREFIX || ""; // ✅ config.json থেকে
    const msg = body.toLowerCase().trim();

    // ✅ খালি প্রিফিক্স হলে: autoreact
    // ✅ প্রিফিক্স থাকলে:.autoreact
    const command = prefix? `${prefix}autoreact` : "autoreact";

    if (msg === command || msg.startsWith(`${command} `)) {
        return this.run({ api, event });
    }

    // ✅ OFF থাকলে রিয়াক্ট দিবে না
    const isOff = global.autoreactStatus[threadID] === false;
    if (isOff) return;

    const emojis = ["🥰", "😗", "🍂", "💜", "☺️", "🖤", "🤗", "😇", "🌺", "🥹", "😻", "😘", "🫣", "😽", "😺", "👀", "❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🤍", "💫", "💦", "🫶", "🫦", "👄", "🗣️", "💏", "👨‍👩‍👦‍👦", "👨‍👨‍👦", "😵", "🥵", "🥶", "🤨", "🤐", "🫡", "🤔"];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

    api.setMessageReaction(randomEmoji, messageID, (err) => {
        if (err) console.log(chalk.red(`[AUTOREACT] Error: ${err.message}`));
    }, true);
};

module.exports.run = async function ({ api, event }) {
    const { threadID, messageID, body } = event;
    const prefix = global.config?.PREFIX || ""; // ✅ config.json থেকে

    // ✅ প্রিফিক্স বাদ দিয়ে আর্গুমেন্ট নাও
    const content = prefix? body.slice(prefix.length).trim() : body.trim();
    const args = content.split(/\s+/);
    const action = args[1]?.toLowerCase(); // autoreact off → args[1] = "off"

    console.log(chalk.yellow(`[AUTOREACT] Prefix: "${prefix}" | Action: ${action} | Body: ${body}`));

    const commandText = prefix? `${prefix}autoreact` : "autoreact";

    if (action!== "on" && action!== "off") {
        const status = global.autoreactStatus[threadID] === false? "OFF 🔴" : "ON 🟢";
        return api.sendMessage(
            `🤖 Auto-React System: ${status}\n\nUse:\n${commandText} on - চালু করতে\n${commandText} off - বন্ধ করতে`,
            threadID,
            messageID
        );
    }

    const newStatus = action === "on"? true : false;
    global.autoreactStatus[threadID] = newStatus;

    console.log(chalk.green(`[AUTOREACT] ${threadID} Set to: ${newStatus? 'ON' : 'OFF'}`));

    return api.sendMessage(
        `🤖 Auto-React System is now ${newStatus? "ON 🟢" : "OFF 🔴"}`,
        threadID,
        messageID
    );
};

module.exports.onStart = async function() {
    const prefix = global.config?.PREFIX || "";
    console.log(chalk.bold.green(`============ AUTOREACT LOADED ============`));
    console.log(chalk.cyan(`[AUTOREACT] Bot Prefix: "${prefix}" ${prefix === ""? "(No Prefix)" : ""}`));
    if (!global.autoreactStatus) global.autoreactStatus = {};
};