const { sendMail } = require("../services/mail.service");
const { renderWelcomeClient } = require("../services/mailTemplates");
const { EmailLog } = require("../../models");

function isValidEmail(s) {
  return typeof s === "string" && /.+@.+\..+/.test(s);
}

module.exports = {
  // GET /api/test/mail/welcome?to=<email>
  sendWelcomeTest: async (req, res) => {
    const rawTo = req.query.to || "ahmalbilalgmail.com"; // value provided by user
    const effectiveTo = isValidEmail(rawTo)
      ? rawTo
      : process.env.TEST_FALLBACK_TO || process.env.SMTP_USER;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER; // fallback

    try {
      const tpl = renderWelcomeClient({ client: { prenom: "Bilal", nom: "Ahmal" } });
      const info = await sendMail({ to: effectiveTo, subject: tpl.subject, html: tpl.html, text: tpl.text, from, template: "welcome" });
      return res.status(200).json({
        ok: true,
        requestedTo: rawTo,
        effectiveTo,
        from,
        providerResponse: {
          messageId: info?.messageId,
          accepted: info?.accepted,
          rejected: info?.rejected,
          envelope: info?.envelope,
          response: info?.response,
        },
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        requestedTo: rawTo,
        effectiveTo,
        from,
        error: {
          name: err?.name,
          message: err?.message,
          code: err?.code,
        },
      });
    }
  },
  // GET /api/test/mail/logs?limit=20
  getMailLogs: async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
      const logs = await EmailLog.findAll({
        order: [["createdAt", "DESC"]],
        limit,
      });
      res.json({ count: logs.length, logs });
    } catch (err) {
      res.status(500).json({ message: "Erreur récupération logs", error: err?.message || String(err) });
    }
  },
};
