
// classifies user message into intent categories
// each intent maps to specific context modules to inject
const INTENT_PATTERNS = {
  care_plan: {
    patterns: [
      /care plan/i,
      /my plan/i,
      /treatment plan/i,
      /what should i do/i,
      /my treatment/i,
      /recovery/i,
    ],
    context_modules: ["active_care_plan_full", "medications", "tasks"],
  },

  medications: {
    patterns: [
      /medication/i,
      /medicine/i,
      /tablet/i,
      /drug/i,
      /pill/i,
      /dose/i,
      /dosage/i,
      /prescription/i,
      /metformin/i,
      /aspirin/i,
    ],
    context_modules: ["medications", "active_care_plan_summary"],
  },

  vitals_metrics: {
    patterns: [
      /blood pressure/i,
      /bp/i,
      /glucose/i,
      /sugar/i,
      /weight/i,
      /heart rate/i,
      /pulse/i,
      /temperature/i,
      /oxygen/i,
      /spo2/i,
      /my readings/i,
      /my vitals/i,
      /my metrics/i,
    ],
    context_modules: ["recent_vitals", "medications"],
  },

  lab_results: {
    patterns: [
      /lab/i,
      /report/i,
      /blood test/i,
      /test result/i,
      /haemoglobin/i,
      /hemoglobin/i,
      /cholesterol/i,
      /creatinine/i,
      /hba1c/i,
      /thyroid/i,
    ],
    context_modules: ["lab_results_summary", "active_care_plan_summary"],
  },

  symptoms: {
    patterns: [
      /symptom/i,
      /feeling/i,
      /i feel/i,
      /side effect/i,
      /nausea/i,
      /headache/i,
      /dizzy/i,
      /pain/i,
      /tired/i,
      /fatigue/i,
      /rash/i,
      /swelling/i,
    ],
    context_modules: [
      "active_care_plan_watch_symptoms",
      "medications",
      "active_care_plan_summary",
    ],
  },

  lifestyle_diet: {
    patterns: [
      /diet/i,
      /food/i,
      /eat/i,
      /drink/i,
      /exercise/i,
      /walk/i,
      /lifestyle/i,
      /avoid/i,
      /can i eat/i,
      /what to eat/i,
      /alcohol/i,
    ],
    context_modules: [
      "diet_recommendations",
      "lifestyle_recommendations",
      "active_care_plan_summary",
    ],
  },

  appointment: {
    patterns: [
      /appointment/i,
      /follow.?up/i,
      /when should i/i,
      /next visit/i,
      /see doctor/i,
      /revisit/i,
    ],
    context_modules: ["follow_up_appointments", "active_care_plan_summary"],
  },

  general_health: {
    patterns: [],
    context_modules: ["profile_summary", "medications", "active_care_plan_summary"],
  },
};

// classifies the user message and returns required context modules
// always includes profile_summary and conversation_history
const classifyIntent = (message) => {
  const detectedIntents = [];
  const contextModules = new Set(["profile_summary", "conversation_history"]);

  for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
    if (intent === "general_health") continue;

    const matched = config.patterns.some((pattern) => pattern.test(message));
    if (matched) {
      detectedIntents.push(intent);
      config.context_modules.forEach((m) => contextModules.add(m));
    }
  }

  if (detectedIntents.length === 0) {
    INTENT_PATTERNS.general_health.context_modules.forEach((m) =>
      contextModules.add(m)
    );
  }

  return {
    intents: detectedIntents.length > 0 ? detectedIntents : ["general_health"],
    context_modules: Array.from(contextModules),
  };
};

module.exports = { classifyIntent, INTENT_PATTERNS };
