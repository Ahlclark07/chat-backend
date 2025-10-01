const {
  getLastMessagesForConversation,
  getConversationWithClientAndGirl,
  getUnprocessedClientConversations,
} = require("../services/conversation.service");

const connectedAdmins = new Map(); // socketId -> adminId
const adminSockets = new Map(); // adminId -> socketId
const assignedConversations = new Map(); // conversationId -> { adminId, timeout, assignedAt, expiresAt }
const pendingMessages = new Map(); // conversationId -> payload

const MAX_CONVERSATIONS_PER_ADMIN = 3;
const ASSIGNMENT_TIMEOUT_MS = 5 * 60 * 1000;

let hasBootstrappedPending = false;

function initMessageDispatcher(io) {
  io.on("connection", (socket) => {
    socket.on("register_admin", async (adminId) => {
      const normalizedId = parseInt(adminId, 10);
      if (Number.isNaN(normalizedId)) {
        return;
      }

      removeExistingAdminConnection(io, normalizedId, socket.id);

      connectedAdmins.set(socket.id, normalizedId);
      adminSockets.set(normalizedId, socket.id);
      console.log("[dispatcher] admin", normalizedId, "connecté.");

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
      console.log("[dispatcher] conversation", conversationId, "traitée par l'admin.");

      await assignPendingConversations(io);
    });

    socket.on("disconnect", async () => {
      const adminId = connectedAdmins.get(socket.id);
      if (!adminId) {
        return;
      }
      connectedAdmins.delete(socket.id);
      if (adminSockets.get(adminId) === socket.id) {
        adminSockets.delete(adminId);
      }
      console.log("[dispatcher] admin", adminId, "déconnecté.");

      await releaseAssignmentsForAdmin(io, adminId);
    });
  });
}

async function handleClientMessage(io, { conversationId }) {
  const payload = await hydratePendingPayload(conversationId);
  if (!payload) {
    return;
  }

  const existingAssignment = assignedConversations.get(conversationId);
  if (existingAssignment) {
    const socketId = adminSockets.get(existingAssignment.adminId);
    if (socketId) {
      payload.assignedAdminId = existingAssignment.adminId;
      payload.isUpdate = true;
      pendingMessages.set(conversationId, payload);
      io.to(socketId).emit("new_message_for_admin", payload);
    } else {
      clearTimeout(existingAssignment.timeout);
      assignedConversations.delete(conversationId);
      await handleClientMessage(io, { conversationId });
    }
    return;
  }

  const preferredAdminId = payload.assignedAdminId;
  if (preferredAdminId && canAdminTakeMore(preferredAdminId)) {
    const assigned = assignToAdmin(io, preferredAdminId, conversationId, payload, false);
    if (assigned) {
      return;
    }
  }

  const availableAdmins = getAvailableAdmins();
  if (availableAdmins.length === 0) {
    console.log("[dispatcher] aucun admin disponible, attribution différée (conv", conversationId, ")");
    return;
  }

  const chosenAdmin = chooseAdminWithLeastLoad(availableAdmins);
  assignToAdmin(io, chosenAdmin, conversationId, payload, false);
}

module.exports = { initMessageDispatcher, handleClientMessage };

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
      payload.assignedAdminId = null;
      pendingMessages.set(conversationId, payload);
    }
    await handleClientMessage(io, { conversationId });
  }
}

function removeExistingAdminConnection(io, adminId, currentSocketId) {
  const existingSocketId = adminSockets.get(adminId);
  if (existingSocketId && existingSocketId !== currentSocketId) {
    const existingSocket = io.sockets.sockets.get(existingSocketId);
    if (existingSocket) {
      existingSocket.emit("force_logout", { reason: "duplicate_session" });
      existingSocket.disconnect(true);
    }
  }
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
    };
  }

  const needsConversationDetails =
    !conversation ||
    !payload.client ||
    !payload.girl ||
    !Array.isArray(payload.girl?.photos);

  if (needsConversationDetails) {
    conversation = conversation || (await getConversationWithClientAndGirl(conversationId));
    if (!conversation) {
      return null;
    }
  }

  if (!payload.client && conversation?.client) {
    payload.client = conversation.client;
  }

  if ((!payload.girl || !Array.isArray(payload.girl?.photos)) && conversation?.girl) {
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

function getAvailableAdmins() {
  return Array.from(adminSockets.keys()).filter((adminId) => canAdminTakeMore(adminId));
}

function canAdminTakeMore(adminId) {
  if (!adminSockets.has(adminId)) {
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

function chooseAdminWithLeastLoad(adminIds) {
  let selected = adminIds[0];
  let minCount = getActiveAssignmentCount(selected);

  for (const adminId of adminIds) {
    const count = getActiveAssignmentCount(adminId);
    if (count < minCount) {
      minCount = count;
      selected = adminId;
    }
  }
  return selected;
}

function assignToAdmin(io, adminId, conversationId, payload, isUpdate) {
  const socketId = adminSockets.get(adminId);
  if (!socketId) {
    return false;
  }

  const timeout = setTimeout(() => {
    console.log(
      "[dispatcher] délai dépassé pour admin",
      adminId,
      "sur conversation",
      conversationId
    );
    assignedConversations.delete(conversationId);
    const entry = pendingMessages.get(conversationId);
    if (entry) {
      entry.assignedAdminId = null;
      pendingMessages.set(conversationId, entry);
    }
    handleClientMessage(io, { conversationId }).catch((err) => {
      console.error("[dispatcher] ré-attribution échouée", err);
    });
  }, ASSIGNMENT_TIMEOUT_MS);

  assignedConversations.set(conversationId, {
    adminId,
    timeout,
    assignedAt: Date.now(),
    expiresAt: Date.now() + ASSIGNMENT_TIMEOUT_MS,
  });

  payload.assignedAdminId = adminId;
  payload.isUpdate = Boolean(isUpdate);
  pendingMessages.set(conversationId, payload);

  io.to(socketId).emit("new_message_for_admin", payload);
  console.log("[dispatcher] conversation", conversationId, "envoyée à l'admin", adminId);
  return true;
}
