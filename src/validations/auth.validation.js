const Joi = require("joi");



// REGISTER
const registerSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required().messages({
        "string.min": "Name must be at least 2 characters",
        "string.max": "Name must not exceed 100 characters",
        "any.required": "Name is required",
    }),

    email: Joi.string().trim().lowercase().email().max(255).required().messages({
        "string.email": "Please provide a valid email address",
        "any.required": "Email is required",
    }),

    password: Joi.string().min(8).max(128).required().messages({
        "string.min": "Password must be at least 8 characters",
        "string.max": "Password must not exceed 128 characters",
        "any.required": "Password is required",
    }),
});


// LOGIN
const loginSchema = Joi.object({
    email: Joi.string().trim().lowercase().email().required().messages({
        "string.email": "Please provide a valid email address",
        "any.required": "Email is required",
    }),

    password: Joi.string().required().messages({
        "any.required": "Password is required",
    }),
});


// REFRESH
const refreshSchema = Joi.object({
    refreshToken: Joi.string().trim().required().messages({
        "any.required": "Refresh token is required",
    }),
});


// LOGOUT
const logoutSchema = Joi.object({
    refreshToken: Joi.string().trim().required().messages({
        "any.required": "Refresh token is required",
    }),
});

// ONBOARDING

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"];
const GENDERS = ["male", "female", "other", "prefer_not_to_say"];

const onboardingSchema = Joi.object({
    date_of_birth: Joi.date()
        .iso()
        .max("now")
        .required()
        .messages({
            "date.base": "Date of birth must be a valid date",
            "date.format": "Date of birth must be in ISO format (YYYY-MM-DD)",
            "date.max": "Date of birth cannot be in the future",
            "any.required": "Date of birth is required",
        }),

    gender: Joi.string()
        .valid(...GENDERS)
        .required()
        .messages({
            "any.only": `Gender must be one of: ${GENDERS.join(", ")}`,
            "any.required": "Gender is required",
        }),

    blood_group: Joi.string()
        .valid(...BLOOD_GROUPS)
        .optional()
        .messages({
            "any.only": `Blood group must be one of: ${BLOOD_GROUPS.join(", ")}`,
        }),

    height_cm: Joi.number()
        .min(50)
        .max(300)
        .optional()
        .messages({
            "number.base": "Height must be a number",
            "number.min": "Height must be at least 50cm",
            "number.max": "Height must not exceed 300cm",
        }),

    weight: Joi.number()
        .min(1)
        .max(500)
        .optional()
        .messages({
            "number.base": "Weight must be a number",
            "number.min": "Weight must be at least 1kg",
            "number.max": "Weight must not exceed 500kg",
        }),
})


module.exports = {
    registerSchema,
    loginSchema,
    refreshSchema,
    logoutSchema,
    onboardingSchema,
};