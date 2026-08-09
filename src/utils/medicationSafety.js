// UTILITY FOR LOCAL MEDICATION DUPLICATION SAFETY


// normalizes a medicine name by lowercasing and removing common dosage suffixes (e.g. "40mg", "tab", "cap")
const normalizeMedName = (name) => {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .replace(/\b(\d+(\.\d+)?\s*(mg|g|mcg|ml|iu|tablets?|capsules?|tabs?|caps?))\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
};


// checks if a new medication name duplicates any existing active medication for the user/profile.
// returns an object with `is_duplicate: boolean` and details if found
const checkLocalDuplicates = (newMedName, activeMedications = []) => {
  const normNew = normalizeMedName(newMedName);
  if (!normNew) return { is_duplicate: false, duplicate_item: null };

  for (const med of activeMedications) {
    const normExisting = normalizeMedName(med.name);
    if (!normExisting) continue;

    // direct match or one is a substring of the other (min 3 chars)
    if (
      normNew === normExisting ||
      (normNew.length >= 3 && normExisting.length >= 3 && (normNew.includes(normExisting) || normExisting.includes(normNew)))
    ) {
      return {
        is_duplicate: true,
        duplicate_item: {
          id: med.id,
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          source: med.source,
        },
        message: `Possible duplicate medication detected: "${med.name}" is already in your active medications.`,
      };
    }
  }

  return { is_duplicate: false, duplicate_item: null };
};

module.exports = {
  normalizeMedName,
  checkLocalDuplicates,
};
