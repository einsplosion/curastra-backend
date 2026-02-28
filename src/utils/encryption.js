const crypto = require("crypto");
const axios = require("axios");
const buildAbhaHeaders = require("./abhaHeaders.js");
const { getGatewayToken } = require("../services/gatewayToken.service.js");

let cachedPublicKey = null;
let keyFetchedAt = null;
const KEY_TTL_MS = 60 * 60 * 1000;

const getAbdmPublicKey = async () => {
  const now = Date.now();

  if (cachedPublicKey && keyFetchedAt && now - keyFetchedAt < KEY_TTL_MS) {
    return cachedPublicKey;
  }

  try {
    if (!process.env.ABDM_BASE_URL) {
      throw new Error("ABDM_BASE_URL not configured");
    }

    const token = await getGatewayToken();

    const response = await axios.get(
      `${process.env.ABDM_BASE_URL}/v3/profile/public/certificate`,
      {
        headers: buildAbhaHeaders(token),
        timeout: 10000,
      }
    );

    if (!response.data.publicKey) {
      throw new Error("Public key not returned by ABDM");
    }

    cachedPublicKey = response.data.publicKey;
    keyFetchedAt = now;

    return cachedPublicKey;

  } catch (err) {
    console.error(
      "Failed to fetch ABDM public key:",
      err.response?.data || err.message
    );
    throw new Error("Failed to fetch ABDM public key");
  }
};

const encryptForAbdm = async (plainText) => {
  if (!plainText) {
    throw new Error("Nothing to encrypt");
  }

  const publicKey = await getAbdmPublicKey();

  const fullPem = publicKey.includes("BEGIN PUBLIC KEY")
    ? publicKey
    : `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

  const encrypted = crypto.publicEncrypt(
    {
      key: fullPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha1",
    },
    Buffer.from(plainText, "utf8")
  );

  return encrypted.toString("base64");
};

module.exports = { encryptForAbdm };