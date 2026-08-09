exports.up = (pgm) => {
    // drop restrictive status check constraint on lab_results table
    pgm.dropConstraint("lab_results", "lab_results_status_check", { ifExists: true });
};

exports.down = (pgm) => {
    pgm.addConstraint("lab_results", "lab_results_status_check", {
        check: "status IN ('normal', 'borderline', 'abnormal', 'high', 'low', 'unknown')",
    });
};
