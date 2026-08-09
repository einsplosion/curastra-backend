// 11 standardized lab categories map
const STANDARD_CATEGORIES = [
  "CBC (Complete Blood Count)",
  "Diabetes / Blood Sugar",
  "Hormone Test",
  "Infection & Inflammation",
  "KFT / RFT (Kidney Function Test)",
  "LFT (Liver Function Test)",
  "Lipid Profile (Cholesterol)",
  "Thyroid Profile",
  "Urine Test (Urinalysis)",
  "Vitamins & Minerals",
  "Other / General",
];

const CATEGORY_MAP = {
  // CBC
  "cbc": "CBC (Complete Blood Count)",
  "complete blood count": "CBC (Complete Blood Count)",
  "haemogram": "CBC (Complete Blood Count)",
  "hemogram": "CBC (Complete Blood Count)",
  "blood count": "CBC (Complete Blood Count)",

  // Diabetes
  "diabetes": "Diabetes / Blood Sugar",
  "blood sugar": "Diabetes / Blood Sugar",
  "glucose": "Diabetes / Blood Sugar",
  "hba1c": "Diabetes / Blood Sugar",
  "glycemic": "Diabetes / Blood Sugar",
  "diabetes / blood sugar": "Diabetes / Blood Sugar",

  // Hormone
  "hormone": "Hormone Test",
  "hormones": "Hormone Test",
  "hormone test": "Hormone Test",
  "cortisol": "Hormone Test",
  "testosterone": "Hormone Test",
  "estrogen": "Hormone Test",

  // Infection & Inflammation
  "infection": "Infection & Inflammation",
  "inflammation": "Infection & Inflammation",
  "crp": "Infection & Inflammation",
  "esr": "Infection & Inflammation",
  "infection & inflammation": "Infection & Inflammation",

  // KFT / RFT
  "kft": "KFT / RFT (Kidney Function Test)",
  "rft": "KFT / RFT (Kidney Function Test)",
  "kidney": "KFT / RFT (Kidney Function Test)",
  "renal": "KFT / RFT (Kidney Function Test)",
  "kft / rft (kidney function test)": "KFT / RFT (Kidney Function Test)",

  // LFT
  "lft": "LFT (Liver Function Test)",
  "liver": "LFT (Liver Function Test)",
  "hepatic": "LFT (Liver Function Test)",
  "lft (liver function test)": "LFT (Liver Function Test)",

  // Lipid
  "lipid": "Lipid Profile (Cholesterol)",
  "cholesterol": "Lipid Profile (Cholesterol)",
  "lipid profile": "Lipid Profile (Cholesterol)",
  "lipid profile (cholesterol)": "Lipid Profile (Cholesterol)",

  // Thyroid
  "thyroid": "Thyroid Profile",
  "tsh": "Thyroid Profile",
  "thyroid profile": "Thyroid Profile",

  // Urine
  "urine": "Urine Test (Urinalysis)",
  "urinalysis": "Urine Test (Urinalysis)",
  "urine test": "Urine Test (Urinalysis)",
  "urine test (urinalysis)": "Urine Test (Urinalysis)",

  // Vitamins & Minerals
  "vitamins": "Vitamins & Minerals",
  "minerals": "Vitamins & Minerals",
  "vitamin d": "Vitamins & Minerals",
  "vitamin b12": "Vitamins & Minerals",
  "calcium": "Vitamins & Minerals",
  "iron": "Vitamins & Minerals",
  "vitamins & minerals": "Vitamins & Minerals",
};


// normalizes raw category string to standard category
const normalizeLabCategory = (rawCategory) => {
  if (!rawCategory || typeof rawCategory !== "string") {
    return "Other / General";
  }

  const cleaned = rawCategory.trim().toLowerCase();

  if (CATEGORY_MAP[cleaned]) {
    return CATEGORY_MAP[cleaned];
  }

  // exact match search
  for (const stdCat of STANDARD_CATEGORIES) {
    if (stdCat.toLowerCase() === cleaned) {
      return stdCat;
    }
  }

  return "Other / General";
};

module.exports = {
  STANDARD_CATEGORIES,
  normalizeLabCategory,
};
