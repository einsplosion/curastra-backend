const axios = require("axios");
const logger = require("../config/logger.js");

let cachedToken = null;
let tokenExpiresAt = null;


const fetchNewToken = async () => {
  try {
    if (!process.env.ABDM_CLIENT_ID || !process.env.ABDM_CLIENT_SECRET) {
      throw new Error("ABDM client credentials not configured");
    }

    const sessionUrl =
      process.env.ABDM_SESSION_URL ||
      "https://dev.abdm.gov.in/gateway/v0.5/sessions";

    const response = await axios.post(
      sessionUrl,
      {
        clientId: process.env.ABDM_CLIENT_ID,
        clientSecret: process.env.ABDM_CLIENT_SECRET,
        grantType: "client_credentials",
      },
      {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 10000,
      }
    );

    return {
      token: response.data.accessToken,
      expiresIn: response.data.expiresIn,
    };
  } catch (err) {
    logger.error(
      "ABDM gateway token fetch failed:", { error: err.response?.data || err.message }
    );
    throw new Error("Failed to fetch ABDM gateway token");
  }
};


const getGatewayToken = async () => {
  const now = Date.now();
  const bufferMs = 60 * 1000;

  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt - bufferMs) {
    return cachedToken;
  }

  logger.info("Fetching new ABDM gateway token...");
  const { token, expiresIn } = await fetchNewToken();

  cachedToken = token;
  tokenExpiresAt = now + expiresIn * 1000;

  logger.info(`Gateway token cached, expires in ${expiresIn}s`);
  return cachedToken;
};

module.exports = { getGatewayToken };