exports.up = (pgm) => {
  pgm.addColumns("profiles", {
    allergies: {
      type: "text[]",
      default: pgm.func("ARRAY[]::text[]"),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns("profiles", ["allergies"]);
};
