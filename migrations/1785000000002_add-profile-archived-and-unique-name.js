exports.up = (pgm) => {
  pgm.addColumns("profiles", {
    is_archived: {
      type: "boolean",
      default: false,
      notNull: true,
    },
  });

  pgm.addConstraint("profiles", "unique_profile_name_per_user", {
    unique: ["owner_user_id", "name"],
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint("profiles", "unique_profile_name_per_user");
  pgm.dropColumns("profiles", ["is_archived"]);
};
