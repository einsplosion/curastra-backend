const Joi = require("joi");

// POST /abha/enroll/initiate 
const enrollInitiateSchema = Joi.object({
    aadhaarNumber: Joi.string()
        .length(12)
        .pattern(/^[0-9]+$/)
        .required()
        .messages({
            "string.length": "Aadhaar number must be exactly 12 digits",
            "string.pattern.base": "Aadhaar number must contain only digits",
            "any.required": "Aadhaar number is required",
        }),

    profile_id: Joi.string()
        .uuid()
        .required()
        .messages({
            "string.uuid": "Invalid profile ID format",
            "any.required": "Profile ID is required",
        }),
});


// POST /abha/enroll/verify
const enrollVerifySchema = Joi.object({
    txnId: Joi.string()
        .required()
        .messages({
            "any.required": "Transaction ID is required",
        }),

    otp: Joi.string()
        .length(6)
        .pattern(/^[0-9]+$/)
        .required()
        .messages({
            "string.length": "OTP must be exactly 6 digits",
            "string.pattern.base": "OTP must contain only digits",
            "any.required": "OTP is required",
        }),

    mobileNumber: Joi.string()
        .length(10)
        .pattern(/^[0-9]+$/)
        .required()
        .messages({
            "string.length": "Mobile number must be exactly 10 digits",
            "string.pattern.base": "Mobile number must contain only digits",
            "any.required": "Mobile number is required",
        }),

    profile_id: Joi.string()
        .uuid()
        .required()
        .messages({
            "string.uuid": "Invalid profile ID format",
            "any.required": "Profile ID is required",
        }),
});

module.exports = { enrollInitiateSchema, enrollVerifySchema };