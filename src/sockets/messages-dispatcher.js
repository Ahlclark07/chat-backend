const {
  getLastMessagesForConversation,
  getConversationWithClientAndGirl,
  getUnprocessedClientConversations,
} = require("../services/conversation.service");

const connectedAdmins = new Map(); // socketId -> adminId
const adminSockets = new Map(); // adminId -> socketId
const assignedConversations = new Map(); // conversationId -> { adminId, timeout }
// conversationId -> { conversationId, client, girl, lastMessages, createdAt, assignedAdminId }
const pendingMessages = new Map();

function initMessageDispatcher(io) {
  io.on("connection", (socket) => {
    socket.on("register_admin", async (adminId) => {
      const normalizedId = parseInt(adminId, 10);
      connectedAdmins.set(socket.id, normalizedId);
      adminSockets.set(normalizedId, socket.id);
      console.log(`🔐 Admin ${adminId} connecté.`);

      // 📦 Récupère toutes les conversations non traitées
      const unprocessed = await getUnprocessedClientConversations();
      for (const conv of unprocessed) {
        const alreadyAssigned = assignedConversations.has(conv.id);
        const alreadyPending = pendingMessages.has(conv.id);
        if (!alreadyAssigned && !alreadyPending) {
          const lastMessages = await getLastMessagesForConversation(conv.id, 7);

          pendingMessages.set(conv.id, {
            conversationId: conv.id,
            client: conv.client,
            girl: conv.girl,
            lastMessages,
            createdAt: Date.now(),
            assignedAdminId: conv.assigned_admin_id || null,
          });
        }
      }
      // console.log(pendingMessages.entries());
      Array.from(pendingMessages.entries()).forEach(async function ([
        convId,
        data,
      ]) {
        const alreadyAssigned = assignedConversations.has(convId);
        if (!alreadyAssigned) {
          handleClientMessage(io, { conversationId: convId });
        }
      });
    });
    socket.on("admin_response", ({ conversationId }) => {
      if (assignedConversations.has(conversationId)) {
        const { timeout } = assignedConversations.get(conversationId);
        clearTimeout(timeout);
        assignedConversations.delete(conversationId);
        pendingMessages.delete(conversationId);
        console.log(`✅ Conversation ${conversationId} traitée par l'admin.`);

        // 🔄 Chercher la prochaine conversation non assignée
        for (const [nextConvId, data] of pendingMessages.entries()) {
          const alreadyAssigned = assignedConversations.has(nextConvId);
          if (!alreadyAssigned) {
            handleClientMessage(io, { conversationId: nextConvId });
            break; // on ne traite qu'une conversation à la fois
          }
        }
      }
    });
    socket.on("disconnect", () => {
      const adminId = connectedAdmins.get(socket.id);
      if (adminId) {
        connectedAdmins.delete(socket.id);
        adminSockets.delete(adminId);
        console.log(`❌ Admin ${adminId} déconnecté.`);
      }
    });
  });
}

async function handleClientMessage(io, { conversationId }) {
  const alreadyAssigned = assignedConversations.has(conversationId);
  if (alreadyAssigned) return;

  let payload = pendingMessages.get(conversationId);

  if (!payload) {
    const conversation = await getConversationWithClientAndGirl(conversationId);
    if (!conversation) {
      console.warn("❌ Conversation introuvable :", conversationId);
      return;
    }

    const lastMessages = await getLastMessagesForConversation(
      conversationId,
      7
    );
    payload = {
      conversationId,
      client: conversation.client,
      girl: conversation.girl,
      lastMessages,
      createdAt: Date.now(),
      assignedAdminId: conversation.assigned_admin_id || null,
    };
    pendingMessages.set(conversationId, payload);
  }
  console.log("size : " + pendingMessages.size);

  // Si une affectation existe et que l'admin est connecté et disponible, préférer cet admin
  if (payload.assignedAdminId) {
    const preferredAdminId = payload.assignedAdminId;
    const socketId = adminSockets.get(preferredAdminId);
    const adminIsConnected = !!socketId;
    const adminIsBusy = Array.from(assignedConversations.values()).some(
      (v) => v.adminId === preferredAdminId
    );

    if (adminIsConnected && !adminIsBusy) {
      const timeout = setTimeout(() => {
        console.log(
          `  ⏱ Temps écoulé pour admin ${preferredAdminId} sur conv ${conversationId}.`
        );
        assignedConversations.delete(conversationId);
        // conversation toujours en attente
        handleClientMessage(io, { conversationId }); // retry
      }, 60000); // 1 minute

      assignedConversations.set(conversationId, {
        adminId: preferredAdminId,
        timeout,
      });

      io.to(socketId).emit("new_message_for_admin", payload);
      console.log(
        `📨 Conversation ${conversationId} envoyée à l'admin assigné ${preferredAdminId}`
      );
      return;
    }
  }

  const availableAdmins = Array.from(adminSockets.keys()).filter(
    (adminId) =>
      !Array.from(assignedConversations.values()).some(
        (v) => v.adminId === adminId
      )
  );

  if (availableAdmins.length === 0) {
    console.log("📥 Aucun admin disponible. Attribution différée.");
    return;
  }

  const randomAdmin =
    availableAdmins[Math.floor(Math.random() * availableAdmins.length)];
  const socketId = adminSockets.get(randomAdmin);

  if (!socketId) return;

  const timeout = setTimeout(() => {
    console.log(
      `  ⏱ Temps écoulé pour admin ${randomAdmin} sur conv ${conversationId}.`
    );
    assignedConversations.delete(conversationId);
    // conversation toujours en attente
    handleClientMessage(io, { conversationId }); // retry
  }, 60000); // 1 minute

  assignedConversations.set(conversationId, { adminId: randomAdmin, timeout });

  io.to(socketId).emit("new_message_for_admin", payload);
  console.log(
    `📨 Conversation ${conversationId} envoyée à admin ${randomAdmin}`
  );
}

module.exports = { initMessageDispatcher, handleClientMessage };
