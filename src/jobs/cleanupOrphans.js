const fs = require("fs");
const path = require("path");
const { Message, GirlPhoto, Girl } = require("../../models");

async function cleanupMessagesMedia() {
  const dir = path.join(__dirname, "..", "..", "uploads", "messages");
  try {
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const used = await Message.findAll({
      attributes: ["media_url"],
      where: { media_url: { not: null } },
      raw: true,
    });
    const usedSet = new Set(
      used.map((m) => (m.media_url || "").trim()).filter(Boolean)
    );
    let removed = 0;
    for (const f of files) {
      if (!usedSet.has(f)) {
        const fp = path.join(dir, f);
        try {
          fs.unlinkSync(fp);
          removed++;
        } catch (e) {
          // ignore
        }
      }
    }
    console.log(`🧹 cleanup(messages): ${removed} fichiers supprimés`);
  } catch (e) {
    console.warn("cleanup messages error:", e.message);
  }
}

async function cleanupGirlsMedia() {
  const dir = path.join(__dirname, "..", "..", "uploads", "girls");
  try {
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const [gallery, girls] = await Promise.all([
      GirlPhoto.findAll({ attributes: ["url"], raw: true }),
      Girl.findAll({ attributes: ["photo_profil"], raw: true }),
    ]);
    const usedSet = new Set([
      ...gallery.map((p) => (p.url || "").trim()).filter(Boolean),
      ...girls.map((g) => (g.photo_profil || "").trim()).filter(Boolean),
    ]);
    let removed = 0;
    for (const f of files) {
      if (!usedSet.has(f)) {
        const fp = path.join(dir, f);
        try {
          fs.unlinkSync(fp);
          removed++;
        } catch (e) {
          // ignore
        }
      }
    }
    console.log(`🧹 cleanup(girls): ${removed} fichiers supprimés`);
  } catch (e) {
    console.warn("cleanup girls error:", e.message);
  }
}

function startCleanupJob({ intervalMs = 6 * 60 * 60 * 1000 } = {}) {
  const run = async () => {
    await cleanupMessagesMedia();
    await cleanupGirlsMedia();
  };
  // Premier passage différé pour laisser la DB se connecter
  setTimeout(run, 10 * 1000);
  setInterval(run, intervalMs);
  console.log(
    `🗓️  Job de nettoyage planifié toutes ${Math.round(
      intervalMs / (60 * 60 * 1000)
    )}h`
  );
}

module.exports = { startCleanupJob };

