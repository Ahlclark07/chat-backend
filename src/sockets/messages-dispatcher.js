const {
  getLastMessagesForConversation,
  getConversationWithClientAndGirl,
  getUnprocessedClientConversations,
} = require("../services/conversation.service");
const {
  getAdminPriorityList,
  setConversationAssignedAdmin,
} = require("../services/conversationAssignment.service");

const connectedAdmins = new Map(); // socketId -> adminId
const adminSockets = new Map(); // adminId -> Set<socketId>
const assignedConversations = new Map(); // conversationId -> { adminId, timeout, assignedAt, expiresAt }
const pendingMessages = new Map(); // conversationId -> payload

const MAX_CONVERSATIONS_PER_ADMIN = 3;
const ASSIGNMENT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_TIMEOUT_HISTORY = 5;
const ASSIGNMENT_ATTEMPT_LIMIT = 10;
const MAX_SOCKET_CONNECTIONS_PER_ADMIN = Math.max(
  1,
  parseInt(
    process.env.MAX_ADMIN_SOCKET_CONNECTIONS ||
      process.env.MAX_CONCURRENT_ADMIN_SESSIONS ||
      "2",
    10
  ) || 2
);

let hasBootstrappedPending = false;

function initMessageDispatcher(io) {
  io.on("connection", (socket) => {
    socket.on("register_admin", async (adminId) => {
      const normalizedId = parseInt(adminId, 10);
      if (Number.isNaN(normalizedId)) {
        return;
      }

      const allowed = ensureAdminConnection(normalizedId, socket);
      if (!allowed) {
        return;
      }

      connectedAdmins.set(socket.id, normalizedId);
      let socketSet = adminSockets.get(normalizedId);
      if (!socketSet) {
        socketSet = new Set();
        adminSockets.set(normalizedId, socketSet);
      }
      socketSet.add(socket.id);
      console.log(
        "[dispatcher] admin",
        normalizedId,
        "connecte (total sockets:",
        socketSet.size,
        ")."
      );

      if (!hasBootstrappedPending) {
        await bootstrapPendingConversations();
        hasBootstrappedPending = true;
      }

      await assignPendingConversations(io);
    });

    socket.on("admin_response", async ({ conversationId }) => {
      if (!conversationId) {
        return;
      }
      const assignment = assignedConversations.get(conversationId);
      if (!assignment) {
        return;
      }

      clearTimeout(assignment.timeout);
      assignedConversations.delete(conversationId);
      pendingMessages.delete(conversationId);
      console.log("[dispatcher] conversation", conversationId, "traitee par l'admin.");

      await assignPendingConversations(io);
    });

    socket.on("disconnect", async () => {
      const adminId = connectedAdmins.get(socket.id);
      if (!adminId) {
        return;
      }
      connectedAdmins.delete(socket.id);
      const sockets = adminSockets.get(adminId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          adminSockets.delete(adminId);
          console.log("[dispatcher] admin", adminId, "deconnecte (plus de socket actif).");
          await releaseAssignmentsForAdmin(io, adminId);
        } else {
          console.log(
            "[dispatcher] admin",
            adminId,
            "deconnecte (sockets restantes:",
            sockets.size,
            ")."
          );
        }
      } else {
        console.log("[dispatcher] admin", adminId, "deconnecte (aucune socket enregistree).");
      }
    });
  });
}

async function handleClientMessage(io, { conversationId }) {
  const payload = await hydratePendingPayload(conversationId);
  if (!payload) {
    return;
  }

  ensurePayloadArrays(payload);

  const excluded = new Set([
    ...payload.attemptedAdminIds,
    ...payload.recentlyTimedOutAdmins,
  ]);

  const existingAssignment = assignedConversations.get(conversationId);
  if (existingAssignment) {
    payload.assignedAdminId = existingAssignment.adminId;
    payload.isUpdate = true;
    payload.updatedAt = Date.now();
    pendingMessages.set(conversationId, payload);

    const delivered = emitToAdminSockets(
      io,
      existingAssignment.adminId,
      "new_message_for_admin",
      payload
    );
    if (delivered) {
      return;
    }
    {
      clearTimeout(existingAssignment.timeout);
      assignedConversations.delete(conversationId);
      try {
        await setConversationAssignedAdmin(conversationId, null);
      } catch (err) {
        console.error(
          "[dispatcher] impossible de nettoyer l'assignation perdue:",
          err
        );
      }
      await handleClientMessage(io, { conversationId });
    }
    return;
  }

  const preferredAdminId = payload.assignedAdminId
    ? parseInt(payload.assignedAdminId, 10)
    : null;
  if (
    preferredAdminId &&
    !excluded.has(preferredAdminId) &&
    canAdminTakeMore(preferredAdminId)
  ) {
    const assigned = assignToAdmin(io, preferredAdminId, conversationId, payload, {
      isUpdate: false,
    });
    if (assigned) {
      return;
    }
    excluded.add(preferredAdminId);
  }

  const ranked = await getAdminPriorityList(conversationId);
  const rankedAvailable = ranked.filter(
    (entry) =>
      !excluded.has(entry.adminId) && canAdminTakeMore(entry.adminId)
  );

  if (rankedAvailable.length > 0) {
    const topScore = rankedAvailable[0].messageCount;
    const topGroup = rankedAvailable.filter(
      (entry) => entry.messageCount === topScore
    );
    const chosenEntry = chooseRandom(topGroup);
    if (chosenEntry) {
      const assigned = assignToAdmin(
        io,
        chosenEntry.adminId,
        conversationId,
        payload,
        { isUpdate: false }
      );
      if (assigned) {
        return;
      }
      excluded.add(chosenEntry.adminId);
    }
  }

  let fallbackAdmins = getAvailableAdmins(excluded);
  if (fallbackAdmins.length === 0) {
    const allAdmins = getAvailableAdmins();
    if (allAdmins.length > 0) {
      console.log(
        "[dispatcher] aucune alternative disponible, tentative avec admin deja sollicite (conv",
        conversationId,
        ")"
      );
      fallbackAdmins = allAdmins;
    }
  }

  if (fallbackAdmins.length === 0) {
    console.log(
      "[dispatcher] aucun admin disponible, attribution differée (conv",
      conversationId,
      ")"
    );
    return;
  }

  const chosenFallback = chooseFallbackAdmin(fallbackAdmins);
  assignToAdmin(io, chosenFallback, conversationId, payload, {
    isUpdate: false,
  });
}

module.exports = {
  initMessageDispatcher,
  handleClientMessage,
  queueConversationForFollowUp,
  getAdminActiveSocketCount,
};

async function bootstrapPendingConversations() {
  const unprocessed = await getUnprocessedClientConversations();
  for (const conversation of unprocessed) {
    await hydratePendingPayload(conversation.id, conversation);
  }
}

async function assignPendingConversations(io) {
  const conversationIds = Array.from(pendingMessages.keys());
  for (const conversationId of conversationIds) {
    if (!assignedConversations.has(conversationId)) {
      await handleClientMessage(io, { conversationId });
    }
  }
}

async function releaseAssignmentsForAdmin(io, adminId) {
  const impacted = [];
  assignedConversations.forEach((value, conversationId) => {
    if (value.adminId === adminId) {
      impacted.push(conversationId);
    }
  });

  for (const conversationId of impacted) {
    const assignment = assignedConversations.get(conversationId);
    if (assignment) {
      clearTimeout(assignment.timeout);
      assignedConversations.delete(conversationId);
    }
    const payload = pendingMessages.get(conversationId);
    if (payload) {
      ensurePayloadArrays(payload);
      payload.assignedAdminId = null;
      payload.recentlyTimedOutAdmins = pushUniqueLimited(
        payload.recentlyTimedOutAdmins,
        adminId,
        MAX_TIMEOUT_HISTORY
      );
      pendingMessages.set(conversationId, payload);
    }
    try {
      await setConversationAssignedAdmin(conversationId, null);
    } catch (err) {
      console.error(
        "[dispatcher] impossible de liberer la conversation",
        conversationId,
        err
      );
    }
    await handleClientMessage(io, { conversationId });
  }
}

function ensureAdminConnection(adminId, socket) {
  const sockets = adminSockets.get(adminId);
  if (!sockets) {
    return true;
  }
  if (sockets.has(socket.id)) {
    return true;
  }
  if (sockets.size >= MAX_SOCKET_CONNECTIONS_PER_ADMIN) {
    console.log(
      "[dispatcher] connexion refusee (limite sockets) pour l'admin",
      adminId
    );
    socket.emit("force_logout", { reason: "max_socket_limit" });
    socket.disconnect(true);
    return false;
  }
  return true;
}

function getAdminSocketIds(adminId) {
  const sockets = adminSockets.get(adminId);
  if (!sockets || sockets.size === 0) {
    return [];
  }
  return Array.from(sockets.values());
}

function emitToAdminSockets(io, adminId, event, payload) {
  const socketIds = getAdminSocketIds(adminId);
  if (!socketIds.length) {
    return false;
  }
  socketIds.forEach((socketId) => {
    io.to(socketId).emit(event, payload);
  });
  return true;
}

function getAdminActiveSocketCount(adminId) {
  const sockets = adminSockets.get(adminId);
  return sockets ? sockets.size : 0;
}

async function hydratePendingPayload(conversationId, baseConversation) {
  let payload = pendingMessages.get(conversationId);
  let conversation = baseConversation;

  if (!payload) {
    if (!conversation) {
      conversation = await getConversationWithClientAndGirl(conversationId);
      if (!conversation) {
        return null;
      }
    }
    payload = {
      conversationId,
      client: conversation.client,
      girl: conversation.girl,
      createdAt: Date.now(),
      assignedAdminId: conversation.assigned_admin_id || null,
      attemptedAdminIds: [],
      recentlyTimedOutAdmins: [],
    };
  }

  const needsConversationDetails =
    !conversation ||
    !payload.client ||
    !payload.girl ||
    !Array.isArray(payload.girl?.photos);

  if (needsConversationDetails) {
    conversation =
      conversation || (await getConversationWithClientAndGirl(conversationId));
    if (!conversation) {
      return null;
    }
  }

  if (!payload.client && conversation?.client) {
    payload.client = conversation.client;
  }

  if (
    (!payload.girl || !Array.isArray(payload.girl?.photos)) &&
    conversation?.girl
  ) {
    payload.girl = conversation.girl;
  }

  if (typeof payload.assignedAdminId === "undefined") {
    payload.assignedAdminId = conversation?.assigned_admin_id || null;
  }

  const lastMessages = await getLastMessagesForConversation(conversationId, 7);
  payload.lastMessages = lastMessages;
  payload.updatedAt = Date.now();
  pendingMessages.set(conversationId, payload);
  return payload;
}

function getAvailableAdmins(excluded = new Set()) {
  const available = [];
  adminSockets.forEach((socketSet, adminId) => {
    if (socketSet && socketSet.size > 0 && !excluded.has(adminId) && canAdminTakeMore(adminId)) {
      available.push(adminId);
    }
  });
  return available;
}

function canAdminTakeMore(adminId) {
  const sockets = adminSockets.get(adminId);
  if (!sockets || sockets.size === 0) {
    return false;
  }
  return getActiveAssignmentCount(adminId) < MAX_CONVERSATIONS_PER_ADMIN;
}

function getActiveAssignmentCount(adminId) {
  let count = 0;
  assignedConversations.forEach((value) => {
    if (value.adminId === adminId) {
      count += 1;
    }
  });
  return count;
}

function chooseFallbackAdmin(adminIds) {
  let selected = adminIds[0];
  let minCount = getActiveAssignmentCount(selected);
  const candidates = [selected];

  for (let i = 1; i < adminIds.length; i += 1) {
    const adminId = adminIds[i];
    const count = getActiveAssignmentCount(adminId);
    if (count < minCount) {
      minCount = count;
      selected = adminId;
      candidates.length = 0;
      candidates.push(adminId);
    } else if (count === minCount) {
      candidates.push(adminId);
    }
  }

  if (candidates.length === 0) {
    return selected;
  }

  return chooseRandom(candidates);
}

function chooseRandom(items) {
  if (!items || items.length === 0) {
    return null;
  }
  const idx = Math.floor(Math.random() * items.length);
  return items[idx];
}

function ensurePayloadArrays(payload) {
  if (!Array.isArray(payload.attemptedAdminIds)) {
    payload.attemptedAdminIds = [];
  }
  if (!Array.isArray(payload.recentlyTimedOutAdmins)) {
    payload.recentlyTimedOutAdmins = [];
  }
}

function pushUniqueLimited(list, value, limit) {
  const result = Array.isArray(list) ? [...list] : [];
  if (!result.includes(value)) {
    result.push(value);
  }
  while (result.length > limit) {
    result.shift();
  }
  return result;
}

async function queueConversationForFollowUp(
  io,
  conversationId,
  options = {}
) {
  if (!io || !conversationId) {
    return false;
  }

  const existing = assignedConversations.get(conversationId);
  if (existing) {
    clearTimeout(existing.timeout);
    assignedConversations.delete(conversationId);
  }

  const payload = await hydratePendingPayload(conversationId);
  if (!payload) {
    return false;
  }

  ensurePayloadArrays(payload);
  payload.followUp = true;
  payload.followUpReason = options.reason || "client_return";
  payload.assignedAdminId = null;
  payload.isUpdate = false;
  payload.updatedAt = Date.now();
  payload.attemptedAdminIds = [];
  payload.recentlyTimedOutAdmins = [];
  pendingMessages.set(conversationId, payload);

  await handleClientMessage(io, { conversationId });
  return true;
}

function assignToAdmin(io, adminId, conversationId, payload, options = {}) {
  const socketIds = getAdminSocketIds(adminId);
  if (!socketIds.length) {
    return false;
  }

  ensurePayloadArrays(payload);
  payload.attemptedAdminIds = pushUniqueLimited(
    payload.attemptedAdminIds,
    adminId,
    ASSIGNMENT_ATTEMPT_LIMIT
  );

  const timeout = setTimeout(() => {
    console.log(
      "[dispatcher] delai depasse pour admin",
      adminId,
      "sur conversation",
      conversationId
    );
    assignedConversations.delete(conversationId);
    const entry = pendingMessages.get(conversationId);
    if (entry) {
      ensurePayloadArrays(entry);
      entry.assignedAdminId = null;
      entry.recentlyTimedOutAdmins = pushUniqueLimited(
        entry.recentlyTimedOutAdmins,
        adminId,
        MAX_TIMEOUT_HISTORY
      );
      pendingMessages.set(conversationId, entry);
    }
    setConversationAssignedAdmin(conversationId, null).catch((err) => {
      console.error(
        "[dispatcher] impossible de liberer apres delai",
        conversationId,
        err
      );
    });
    handleClientMessage(io, { conversationId }).catch((err) => {
      console.error("[dispatcher] re-attribution echouee", err);
    });
  }, ASSIGNMENT_TIMEOUT_MS);

  assignedConversations.set(conversationId, {
    adminId,
    timeout,
    assignedAt: Date.now(),
    expiresAt: Date.now() + ASSIGNMENT_TIMEOUT_MS,
  });

  payload.assignedAdminId = adminId;
  payload.isUpdate = Boolean(options.isUpdate);
  payload.updatedAt = Date.now();
  pendingMessages.set(conversationId, payload);

  setConversationAssignedAdmin(conversationId, adminId).catch((err) => {
    console.error(
      "[dispatcher] impossible d'enregistrer l'assignation",
      conversationId,
      "->",
      adminId,
      err
    );
  });

  emitToAdminSockets(io, adminId, "new_message_for_admin", payload);
  console.log("[dispatcher] conversation", conversationId, "envoyee a l'admin", adminId);
  return true;
}
