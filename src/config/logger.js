const winston = require("winston");
const util = require("util");

const logger = winston.createLogger({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'curastra-backend' },
    transports: [
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/audit.log", level: "info" }),
        new winston.transports.File({ filename: "logs/combined.log" }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    let metaStr = "";
                    if (Object.keys(meta).length) {
                        try {
                            metaStr = JSON.stringify(meta, null, 2);
                        } catch (e) {
                            metaStr = util.inspect(meta, { depth: 2 });
                        }
                    }
                    return `[${timestamp}] ${level}: ${message} ${metaStr}`;
                })
            ),
        }),
    ],
});

module.exports = logger;