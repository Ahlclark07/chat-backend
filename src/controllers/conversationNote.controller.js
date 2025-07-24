const { ConversationNote } = require("../../models");

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

      res.status(201).json(note);
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
