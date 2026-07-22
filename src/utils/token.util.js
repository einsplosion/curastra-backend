const jwt = require("jsonwebtoken")
const crypto = require("crypto");
const logger = require("../config/logger");

// constants
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = "15m";

if (!ACCESS_TOKEN_SECRET) {
    logger.error("JWT_SECRET is not defined in environment variables");
    process.exit(1);
}

// ACCESS TOKENS
// generate signed access token
const generateAccessToken = (userId) => {
    return jwt.sign(
        { id: userId },
        ACCESS_TOKEN_SECRET,
        {
            expiresIn: ACCESS_TOKEN_EXPIRY
        }
    );
};

// verifies the access token
const verifyAccessToken = (token) => {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
};


// REFRESH TOKENS
// generate refresh token, hashed token stored in db
const generateRefreshToken = () => {
    return crypto.randomBytes(64).toString("hex");
};

// hash refresh token before storing in db
const hashRefreshToken = (token) => {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
};


module.exports = {
    generateAccessToken,
    verifyAccessToken,
    generateRefreshToken,
    hashRefreshToken
};