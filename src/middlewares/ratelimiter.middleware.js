const rateLimit = require("express-rate-limit");

// REGISTER LIMITER
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,  // 10 attempts per hour
    message: {
        error: "Too many registration attempts. Please try again after an hour."
    },
    standardHeaders: true,
    legacyHeaders: false
});


// LOGIN LIMITER
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        error: "Too many login attempts. Please try again after 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,  // skip requests that return a response with status code < 400
});


// REFRESH TOKEN LIMITER
const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: {
        error: "Too many refresh token attempts. Please try again after 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false,
});



// ABHA LIMITER
const abhaLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: {
        error: "Too many ABHA enrollment attempts. Please try again after an hour."
    },
    standardHeaders: true,
    legacyHeaders: false
});


// GENERAL LIMITER
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: "Too many requests. Please try again after 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false
});

// CHAT LIMITER
const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 15, // 15 chat messages per minute
    message: {
        success: false,
        message: "Chat rate limit exceeded. Please wait a moment before sending more messages."
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = { loginLimiter, registerLimiter, abhaLimiter, generalLimiter, refreshLimiter, chatLimiter };