const crypto = require("crypto");

function normalize(value, fallback = "unknown") {
  if (!value || typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function buildDeviceFingerprint(ip, userAgent) {
  const normalizedIp = normalize(ip).toLowerCase();
  const normalizedAgent = normalize(userAgent);
  const payload = `${normalizedIp}::${normalizedAgent}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function extractRequestDeviceIdentity(req) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    null;
  const userAgent = req.headers["user-agent"] || "unknown";
  const fingerprint = buildDeviceFingerprint(ip, userAgent);
  return { ip, userAgent, fingerprint };
}

module.exports = {
  buildDeviceFingerprint,
  extractRequestDeviceIdentity,
};
