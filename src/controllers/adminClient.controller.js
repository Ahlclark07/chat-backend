const db = require("../../models");
const { Op } = require("sequelize");

const { Client, Conversation, CreditTransaction, AdminActivityLog, SuspensionReason } = db;
const { sequelize } = db;

const CLIENT_ID_REF = 'Client.id';

const buildStatsAttributes = () => [
  [
    sequelize.literal(`(
      SELECT COALESCE(SUM(CASE WHEN ct.amount < 0 THEN -ct.amount ELSE 0 END), 0)
      FROM CreditTransactions AS ct
      WHERE ct.client_id = ${CLIENT_ID_REF}
    )`),
    "credits_spent",
  ],
  [
    sequelize.literal(`(
      SELECT COUNT(*)
      FROM Conversations AS conv
      WHERE conv.client_id = ${CLIENT_ID_REF} AND conv.closed_at IS NULL
    )`),
    "active_conversations",
  ],
  [
    sequelize.literal(`(
      SELECT COUNT(*)
      FROM Conversations AS conv_all
      WHERE conv_all.client_id = ${CLIENT_ID_REF}
    )`),
    "total_conversations",
  ],
];

const formatClient = (instance) => {
  const plain = instance.get({ plain: true });
  plain.credits_spent = Number(plain.credits_spent ?? 0);
  plain.active_conversations = Number(plain.active_conversations ?? 0);
  plain.total_conversations = Number(plain.total_conversations ?? 0);
  return plain;
};

const parseBoolean = (value) => {
  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }
  if (value === false || value === "false" || value === 0 || value === "0") {
    return false;
  }
  return null;
};

module.exports = {
  async listClients(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limitRaw = parseInt(req.query.limit, 10);
      const limit = limitRaw && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;
      const offset = (page - 1) * limit;
      const { search } = req.query;

      const where = {};

      const isBannedFilter = parseBoolean(req.query.is_banned);
      if (isBannedFilter !== null) {
        where.is_banned = isBannedFilter;
      }

      if (search) {
        const like = `%${search}%`;
        where[Op.or] = [
          { nom: { [Op.like]: like } },
          { prenom: { [Op.like]: like } },
          { pseudo: { [Op.like]: like } },
          { email: { [Op.like]: like } },
          { telephone: { [Op.like]: like } },
        ];
      }

      const clients = await Client.findAndCountAll({
        where,
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        attributes: {
          exclude: ["mot_de_passe"],
          include: buildStatsAttributes(),
        },
        include: [
          { association: "pays", attributes: ["id", "name"] },
          { association: "ville", attributes: ["id", "name"] },
        ],
        distinct: true,
      });

      const data = clients.rows.map(formatClient);

      return res.status(200).json({
        total: clients.count,
        page,
        pageSize: limit,
        totalPages: Math.ceil(clients.count / limit),
        data,
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors du chargement des clients." });
    }
  },

  async getClientById(req, res) {
    try {
      const clientId = parseInt(req.params.id, 10);
      if (!Number.isInteger(clientId)) {
        return res.status(400).json({ message: "Identifiant invalide." });
      }

      const client = await Client.findByPk(clientId, {
        attributes: {
          exclude: ["mot_de_passe"],
          include: buildStatsAttributes(),
        },
        include: [
          { association: "pays", attributes: ["id", "name"] },
          { association: "ville", attributes: ["id", "name"] },
        ],
      });

      if (!client) {
        return res.status(404).json({ message: "Client introuvable." });
      }

      const formatted = formatClient(client);

      const [activeConversations, recentTransactions] = await Promise.all([
        Conversation.findAll({
          where: { client_id: clientId, closed_at: null },
          include: [
            {
              association: "girl",
              attributes: ["id", "nom", "prenom"],
            },
          ],
          attributes: ["id", "girl_id", "opened_at", "createdAt", "updatedAt"],
          order: [["updatedAt", "DESC"]],
        }),
        CreditTransaction.findAll({
          where: { client_id: clientId },
          order: [["createdAt", "DESC"]],
          limit: 10,
          attributes: ["id", "amount", "conversation_id", "createdAt"],
        }),
      ]);

      formatted.active_conversations_details = activeConversations.map((c) =>
        c.get({ plain: true })
      );
      formatted.recent_transactions = recentTransactions.map((t) =>
        t.get({ plain: true })
      );

      return res.status(200).json(formatted);
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de la recuperation du client." });
    }
  },

  async updateBanStatus(req, res) {
    try {
      const clientId = parseInt(req.params.id, 10);
      if (!Number.isInteger(clientId)) {
        return res.status(400).json({ message: "Identifiant invalide." });
      }

      const client = await Client.findByPk(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client introuvable." });
      }

      const desiredStatus = parseBoolean(req.body.is_banned);
      if (desiredStatus === null) {
        return res
          .status(400)
          .json({ message: "Valeur is_banned invalide." });
      }

      const reason = req.body.ban_reason ?? req.body.banReason ?? null;
      const expiresAtRaw =
        req.body.ban_expires_at ?? req.body.banExpiresAt ?? null;

      let banExpiresAt = null;
      if (expiresAtRaw) {
        const parsedDate = new Date(expiresAtRaw);
        if (Number.isNaN(parsedDate.getTime())) {
          return res
            .status(400)
            .json({ message: "Date d'expiration invalide." });
        }
        banExpiresAt = parsedDate;
      }

      const updates = {
        is_banned: desiredStatus,
        ban_reason: desiredStatus ? reason : null,
        ban_expires_at: desiredStatus ? banExpiresAt : null,
      };

      await client.update(updates);

      // Log suspension reason when banning
      if (desiredStatus === true) {
        try {
          await SuspensionReason.create({
            user_type: 'Client',
            user_id: client.id,
            suspended_by_id: req.admin.id,
            reason: reason || null,
          });
        } catch (e) {}
      }


      await AdminActivityLog.create({
        admin_id: req.admin.id,
        action: desiredStatus ? "CLIENT_BANNED" : "CLIENT_UNBANNED",
        target_type: "Client",
        target_id: client.id,
        details: desiredStatus
          ? `Banni par admin ${req.admin.id}${
              reason ? ` - Motif: ${reason}` : ""
            }`
          : `Reactivation par admin ${req.admin.id}`,
      }).catch(() => {});

      const refreshed = await Client.findByPk(clientId, {
        attributes: {
          exclude: ["mot_de_passe"],
          include: buildStatsAttributes(),
        },
        include: [
          { association: "pays", attributes: ["id", "name"] },
          { association: "ville", attributes: ["id", "name"] },
        ],
      });

      return res.status(200).json(formatClient(refreshed));
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Erreur lors de la mise a jour du statut." });
    }
  },
};








