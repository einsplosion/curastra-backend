exports.up = (pgm) => {
    pgm.addColumns("lab_results", {
        category: {
            type: "text",
            default: "Other / General",
        },
        can_sync_to_metrics: {
            type: "boolean",
            default: false,
        },
        suggested_metric_type: {
            type: "text",
        },
        numeric_value_primary: {
            type: "numeric",
        },
        numeric_value_secondary: {
            type: "numeric",
        },
    });

    pgm.addColumns("records", {
        extracted_text: {
            type: "text",
        },
        ocr_used: {
            type: "boolean",
            default: false,
        },
    });

    pgm.createIndex("lab_results", ["user_id", "category"]);
};

exports.down = (pgm) => {
    pgm.dropIndex("lab_results", ["user_id", "category"]);
    pgm.dropColumns("lab_results", [
        "category",
        "can_sync_to_metrics",
        "suggested_metric_type",
        "numeric_value_primary",
        "numeric_value_secondary",
    ]);
    pgm.dropColumns("records", [
        "extracted_text",
        "ocr_used",
    ]);
};
