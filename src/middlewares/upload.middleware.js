const multer = require("multer");
const path = require("path");

// Destination des uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/clients/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `client_${Date.now()}${ext}`;
    cb(null, filename);
  },
});

// Filtrage par type MIME
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Fichier non supporté"), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = {
  uploadClientPhoto: upload.single("photo_profil"),
};
