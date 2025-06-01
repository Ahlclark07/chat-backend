const { AdminActivityLog } = require("../../models");

async function logAdminAction({
  adminId,
  action,
  targetType,
  targetId,
  details,
}) {
  await AdminActivityLog.create({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details ? JSON.stringify(details) : null,
  });
}

module.exports = logAdminAction;
