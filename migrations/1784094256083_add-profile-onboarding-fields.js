exports.up = (pgm) => {
    pgm.addColumns("profiles", {
        height_cm: {
            type: "numeric",
        },
        is_onboarding_complete: {
            type: "boolean",
            notNull: true,
            default: false,
        },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns("profiles", [
        "height_cm",
        "is_onboarding_complete",
    ]);
};