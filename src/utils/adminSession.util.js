"use strict";

const DEFAULT_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function normalizeSessionEntry(entry, fallbackStartedAt) {
  if (!entry) {
    return null;
  }

  if (typeof entry === "string") {
    const normalizedToken = entry.trim();
    if (!normalizedToken) {
      return null;
    }
    const startedAt = fallbackStartedAt
      ? new Date(fallbackStartedAt)
      : new Date();
    if (Number.isNaN(startedAt.getTime())) {
      return null;
    }
    return {
      token: normalizedToken,
      startedAt: startedAt.toISOString(),
    };
  }

  if (typeof entry !== "object") {
    return null;
  }

  const tokenCandidate = entry.token || entry.sessionId || entry.id;
  if (!tokenCandidate || typeof tokenCandidate !== "string") {
    return null;
  }

  const trimmed = tokenCandidate.trim();
  if (!trimmed) {
    return null;
  }

  const startedAtCandidate =
    entry.startedAt || entry.started_at || entry.createdAt || fallbackStartedAt;
  const startedAt = startedAtCandidate ? new Date(startedAtCandidate) : new Date();
  if (Number.isNaN(startedAt.getTime())) {
    return null;
  }

  return {
    token: trimmed,
    startedAt: startedAt.toISOString(),
  };
}

function parseAdminSessions(raw, fallbackStartedAt) {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw
      .map((entry) => normalizeSessionEntry(entry, fallbackStartedAt))
      .filter(Boolean);
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) {
          return [];
        }
        return parsed
          .map((entry) => normalizeSessionEntry(entry, fallbackStartedAt))
          .filter(Boolean);
      } catch (_) {
        return [];
      }
    }

    const single = normalizeSessionEntry(trimmed, fallbackStartedAt);
    return single ? [single] : [];
  }

  return [];
}

function serializeAdminSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return null;
  }
  return JSON.stringify(
    sessions.map((session) => ({
      token: session.token,
      startedAt: session.startedAt,
    }))
  );
}

function cleanupExpiredSessions(
  sessions,
  maxAgeMs = DEFAULT_SESSION_MAX_AGE_MS,
  referenceDate = new Date()
) {
  const now =
    referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();
  const active = [];
  const expired = [];

  sessions.forEach((session) => {
    if (!session || !session.token) {
      return;
    }
    const startedAt = new Date(session.startedAt || session.started_at);
    if (Number.isNaN(startedAt.getTime())) {
      expired.push(session);
      return;
    }
    if (now.getTime() - startedAt.getTime() >= maxAgeMs) {
      expired.push(session);
      return;
    }
    active.push({
      token: session.token,
      startedAt: startedAt.toISOString(),
    });
  });

  return { active, expired };
}

function addSession(sessions, token, startedAt = new Date()) {
  if (!token) {
    return Array.isArray(sessions) ? [...sessions] : [];
  }
  const list = Array.isArray(sessions) ? [...sessions] : [];
  const normalizedStartedAt =
    startedAt instanceof Date ? startedAt : new Date(startedAt);
  const iso =
    Number.isNaN(normalizedStartedAt.getTime())
      ? new Date().toISOString()
      : normalizedStartedAt.toISOString();

  const filtered = list.filter((session) => session.token !== token);
  filtered.push({ token, startedAt: iso });
  return filtered;
}

function removeSession(sessions, token) {
  if (!Array.isArray(sessions) || !token) {
    return [];
  }
  return sessions.filter((session) => session.token !== token);
}

function getLastSessionDate(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return null;
  }
  let latest = null;
  sessions.forEach((session) => {
    if (!session) {
      return;
    }
    const startedAt = new Date(session.startedAt || session.started_at);
    if (Number.isNaN(startedAt.getTime())) {
      return;
    }
    if (!latest || startedAt.getTime() > latest.getTime()) {
      latest = startedAt;
    }
  });
  return latest;
}

module.exports = {
  DEFAULT_SESSION_MAX_AGE_MS,
  parseAdminSessions,
  serializeAdminSessions,
  cleanupExpiredSessions,
  addSession,
  removeSession,
  getLastSessionDate,
};
