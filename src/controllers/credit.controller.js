const { Client, CreditTransaction } = require("../../models");
const { getCoinOffers } = require("../services/coinOffers.service");

module.exports = {
  // GET /api/credits/offers
  async listOffers(req, res) {
    try {
      const offers = await getCoinOffers();
      return res.json(offers);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Erreur lors du chargement des offres." });
    }
  },
  // POST /api/credits/purchase
  async purchaseCredits(req, res) {
    try {
      const clientId = req.user?.id;
      if (!clientId) return res.status(401).json({ message: "Non autorisé." });

      const { amount } = req.body;
      const qty = parseInt(amount, 10);
      if (!Number.isFinite(qty) || qty <= 0) {
        return res
          .status(400)
          .json({ message: "Quantité invalide. Doit être un entier > 0." });
      }
      if (qty > 1000000) {
        return res
          .status(400)
          .json({ message: "Quantité trop élevée." });
      }

      // Placeholder moyen de paiement: à intégrer ici plus tard
      // Exemple: créer une intention de paiement et valider avant crédit

      // Mise à jour atomique du solde
      await Client.increment("credit_balance", { by: qty, where: { id: clientId } });
      const client = await Client.findByPk(clientId, {
        attributes: { exclude: ["mot_de_passe"] },
      });

      // Enregistrer la transaction (positive = achat/crédit)
      const tx = await CreditTransaction.create({
        client_id: clientId,
        conversation_id: null,
        message_id: null,
        amount: qty,
      });

      return res.status(201).json({
        message: "Crédits ajoutés avec succès.",
        transaction: { id: tx.id, amount: tx.amount, createdAt: tx.createdAt },
        balance: client.credit_balance,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erreur lors de l'achat de crédits." });
    }
  },
};
