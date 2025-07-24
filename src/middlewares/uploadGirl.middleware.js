const multer = require("multer");
const path = require("path");

// Destination des uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/girls/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `girls_${Date.now()}_${file.fieldname}${ext}`;
    cb(null, filename);
  },
});

// Filtrage des fichiers
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Fichier non supporté"), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = {
  // Gestion d'un champ 'photo_profil' + champ 'photos[]' pour la galerie
  uploadGirlPhoto: upload.fields([
    { name: "photo_profil", maxCount: 1 },
    { name: "photos", maxCount: 10 },
  ]),
};
