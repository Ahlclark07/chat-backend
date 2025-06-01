const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/messages/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `msg_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/", "video/"];
  if (allowed.some((type) => file.mimetype.startsWith(type))) {
    cb(null, true);
  } else {
    cb(new Error("Fichier non supporté"), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = {
  uploadMessageFile: upload.single("media"),
};
