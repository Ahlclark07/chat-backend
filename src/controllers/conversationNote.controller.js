const { ConversationNote, Admin } = require("../../models");

module.exports = {
  async createNote(req, res) {
    try {
      const { conversation_id } = req.params;
      const { contenu } = req.body;

      const note = await ConversationNote.create({
        conversation_id,
        admin_id: req.admin.id,
        contenu,
      });

      const hydratedNote = await ConversationNote.findByPk(note.id, {
        include: [
          {
            model: Admin,
            as: "admin",
            attributes: ["id", "nom", "prenom", "email", "identifiant", "role"],
          },
        ],
      });

      res.status(201).json(hydratedNote);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Erreur lors de la création de la note." });
    }
  },

  async getNotes(req, res) {
    try {
      const { conversation_id } = req.params;

      const notes = await ConversationNote.findAll({
        where: { conversation_id },
        order: [["createdAt", "ASC"]],
        include: [
          {
            model: Admin,
            as: "admin",
            attributes: ["id", "nom", "prenom", "email", "identifiant", "role"],
          },
        ],
      });

      res.json(notes);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Erreur lors de la récupération des notes." });
    }
  },
};
