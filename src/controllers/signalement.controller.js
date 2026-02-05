const {
  Signalement,
  Admin,
  Conversation,
  Client,
  Girl,
  Message,
} = require("../../models");
const {
  formatMessages,
  scrubIdentifiant,
} = require("../utils/messageFormatter");

const ALLOWED_STATUS = ["en_cours", "termine"];

function buildConversationInclude({ includeMessages = false } = {}) {
  const include = {
    model: Conversation,
    as: "conversation",
    include: [
      {
        model: Client,
        as: "client",
        attributes: ["id", "nom", "prenom"],
      },
      {
        model: Girl,
        as: "girl",
        attributes: ["id", "nom", "prenom"],
      },
      {
        model: Admin,
        as: "assigned_admin",
        attributes: ["id", "nom", "prenom", "identifiant"],
      },
    ],
  };

  if (includeMessages) {
    include.include.push({
      model: Message,
      as: "messages",
      separate: true,
      order: [["createdAt", "ASC"]],
      include: [
        {
          model: Admin,
          as: "sender_admin",
          attributes: ["id", "nom", "prenom", "identifiant"],
        },
      ],
    });
  }

  return include;
}

const AUTHOR_INCLUDE = {
  model: Admin,
  as: "auteur",
  attributes: ["id", "nom", "prenom", "email", "role"],
};

const CLIENT_INCLUDE = {
  model: Client,
  as: "client",
  attributes: ["id", "nom", "prenom", "email", "pseudo"],
};

const GIRL_INCLUDE = {
  model: Girl,
  as: "girl",
  attributes: ["id", "nom", "prenom", "pseudo", "sexe"],
};

function presentSignalement(
  instance,
  { includeMessages = false, exposeAdminIdentifiers = false } = {}
) {
  if (!instance) {
    return null;
  }
  const json = instance.toJSON();
  if (json.auteur) {
    json.auteur = scrubIdentifiant(json.auteur, exposeAdminIdentifiers);
  }

  if (json.conversation?.assigned_admin) {
    json.conversation.assigned_admin = scrubIdentifiant(
      json.conversation.assigned_admin,
      exposeAdminIdentifiers
    );
  }

  if (includeMessages && json.conversation) {
    const messagesArray = Array.isArray(json.conversation.messages)
      ? json.conversation.messages
      : [];
    const assignedAdmin = json.conversation.assigned_admin || null;
    json.conversation.messages = formatMessages(messagesArray, {
      assignedAdmin,
      exposeAdminIdentifiers,
    });
  } else if (json.conversation?.messages) {
    delete json.conversation.messages;
  }

  return json;
}

async function loadSignalementById(
  id,
  { includeMessages = false, exposeAdminIdentifiers = false } = {}
) {
  const record = await Signalement.findByPk(id, {
    include: [
      AUTHOR_INCLUDE,
      CLIENT_INCLUDE,
      GIRL_INCLUDE,
      buildConversationInclude({ includeMessages }),
    ],
  });
  if (!record) {
    return null;
  }
  return presentSignalement(record, {
    includeMessages,
    exposeAdminIdentifiers,
  });
}

module.exports = {
  async create(req, res) {
    try {
      const {
        message,
        conversation_id: snakeConversationId,
        conversationId,
      } = req.body;
      const exposeIdentifiant = req.admin?.role === "god";
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({
          message: "Le message du signalement est obligatoire.",
        });
      }

      let parsedConversationId = snakeConversationId ?? conversationId ?? null;
      if (parsedConversationId !== null && parsedConversationId !== undefined) {
        parsedConversationId = parseInt(parsedConversationId, 10);
        if (Number.isNaN(parsedConversationId)) {
          return res.status(400).json({
            message: "L'identifiant de conversation est invalide.",
          });
        }
        const conversationExists = await Conversation.findByPk(
          parsedConversationId,
          {
            attributes: ["id"],
          }
        );
        if (!conversationExists) {
          return res
            .status(404)
            .json({ message: "Conversation liee introuvable." });
        }
      } else {
        parsedConversationId = null;
      }

      const signalement = await Signalement.create({
        admin_id: req.admin.id,
        message: message.trim(),
        conversation_id: parsedConversationId,
      });

      const payload = await loadSignalementById(signalement.id, {
        exposeAdminIdentifiers: exposeIdentifiant,
      });

      return res.status(201).json(payload);
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de la creation du signalement." });
    }
  },

  async list(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
      const { status } = req.query;
      const exposeIdentifiant = req.admin?.role === "god";

      const where = {};
      if (status) {
        if (!ALLOWED_STATUS.includes(status)) {
          return res.status(400).json({
            message: "Le statut demandé est invalide.",
          });
        }
        where.status = status;
      }

      const { rows, count } = await Signalement.findAndCountAll({
        where,
        include: [AUTHOR_INCLUDE, CLIENT_INCLUDE, GIRL_INCLUDE, buildConversationInclude()],
        order: [["createdAt", "DESC"]],
        limit,
        offset: (page - 1) * limit,
      });

      return res.json({
        total: count,
        page,
        pageSize: limit,
        totalPages: Math.ceil(count / limit),
        data: rows.map((row) =>
          presentSignalement(row, {
            exposeAdminIdentifiers: exposeIdentifiant,
          })
        ),
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de la récupération des signalements." });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const exposeIdentifiant = req.admin?.role === "god";
      const signalement = await loadSignalementById(id, {
        includeMessages: true,
        exposeAdminIdentifiers: exposeIdentifiant,
      });

      if (!signalement) {
        return res.status(404).json({ message: "Signalement introuvable." });
      }

      return res.json(signalement);
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de la recuperation du signalement." });
    }
  },

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!ALLOWED_STATUS.includes(status)) {
        return res.status(400).json({
          message: "Le statut doit être 'en_cours' ou 'termine'.",
        });
      }

      const signalement = await Signalement.findByPk(id);
      if (!signalement) {
        return res.status(404).json({ message: "Signalement introuvable." });
      }

      const updates = { status };
      if (status === "termine") {
        updates.resolved_at =
          signalement.status === "termine" && signalement.resolved_at
            ? signalement.resolved_at
            : new Date();
      } else {
        updates.resolved_at = null;
      }

      await signalement.update(updates);

      const exposeIdentifiant = req.admin?.role === "god";
      const refreshed = await loadSignalementById(id, {
        includeMessages: true,
        exposeAdminIdentifiers: exposeIdentifiant,
      });

      return res.json(refreshed);
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Erreur lors de la mise à jour du signalement.",
      });
    }
  },

  async remove(req, res) {
    try {
      const { id } = req.params;
      const signalement = await Signalement.findByPk(id);
      if (!signalement) {
        return res.status(404).json({ message: "Signalement introuvable." });
      }

      await signalement.destroy();
      return res.status(204).send();
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de la suppression du signalement." });
    }
  },
};
