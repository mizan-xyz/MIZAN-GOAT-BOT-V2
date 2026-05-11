module.exports = {
  config: {
    name: "mention",
    version: "1.0",
    author: "MOSTAKIM",
    role: 0,
    shortDescription: {
      en: "Auto reply when boss is mentioned"
    },
    longDescription: {
      en: "Bot replies when the boss is mentioned"
    },
    category: "owner"
  },

  onStart: async function () { },

  onChat: async function ({ api, event }) {
    const bossUID = "100058112936375";

    if (!event.mentions) return;

    if (event.mentions[bossUID]) {
      const replies = [
        "😈 Boss ekhon busy ache 😌",
        "ডাকাডাকি করিস না বস ব্যস্ত আছে 😒😌",
        "বস এক আবালে আপনাকে মেনশন দিছে 😑🌚😁",
        "যেভাবে মেনশন দিতাচত মনে হয় তোর গার্লফ্রেন্ডটারে দিয়া দিবি 🫥😒",
        "বস এক পাগল ছাগল আপনাকে ডাকতেছে 🐸🫵",
        "মেনশন না দিয়া একটা girlfriend খুজে দে 😵‍💫",
        "বস এখন ব্যস্ত আছে , কিছু বলতে হলে ইনবক্স এ গিয়া বল 😉",
        "বস এখন আমার সাথে মিটিং এ আছে , মেনশন দিস না 🙂",
        "কিরে তোর এতো সাহস আমার বসের নাম ধরিস 😾🫵",
        "মেনশন দিয়ে লাভ নাই বস মোস্তাকিম এখন বিজি আছেন 😗"
      ];

      const randomReply = replies[Math.floor(Math.random() * replies.length)];

      return api.sendMessage(
        randomReply,
        event.threadID,
        event.messageID
      );
    }
  }
};