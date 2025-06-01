const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "7d";
function generateAccessToken(client) {
  return jwt.sign({ id: client.id, role: "client" }, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });
}

function generateRefreshToken() {
  return uuidv4(); // simple string à stocker en DB
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};
