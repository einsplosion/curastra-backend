const { v4: uuidv4 } = require("uuid");

const buildAbhaHeaders = (token) => {
  return {
    "Authorization": `Bearer ${token}`,
    "REQUEST-ID": uuidv4(),
    "TIMESTAMP": new Date().toISOString(),
    "Accept": "application/json",
    "Content-Type": "application/json",
  };
};

module.exports = buildAbhaHeaders;

