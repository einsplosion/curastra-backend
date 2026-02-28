const axios = require("axios");

let cachedToken = null;
let tokenExpiresAt = null;


const fetchNewToken = async () => {
  try {
    if (!process.env.ABDM_CLIENT_ID || !process.env.ABDM_CLIENT_SECRET) {
      throw new Error("ABDM client credentials not configured");
    }

    const response = await axios.post(
      "https://dev.abdm.gov.in/gateway/v0.5/sessions",
      {
        clientId: process.env.ABDM_CLIENT_ID,
        clientSecret: process.env.ABDM_CLIENT_SECRET,
        grantType: "client_credentials",
      },
      {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    return {
      token: response.data.accessToken,
      expiresIn: response.data.expiresIn,
    };
  } catch (err) {
    console.error(
      "ABDM gateway token fetch failed:",
      err.response?.data || err.message
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

  console.log("Fetching new ABDM gateway token...");
  const { token, expiresIn } = await fetchNewToken();

  cachedToken = token;
  tokenExpiresAt = now + expiresIn * 1000;

  console.log(`Gateway token cached, expires in ${expiresIn}s`);
  return cachedToken;
};

module.exports = { getGatewayToken };