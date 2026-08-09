// Prompt Assembler (Token Optimizer)
// aggressively compresses context into a structured prompt targeting ~950–1450 tokens

const buildSystemPrompt = (context) => {
  const parts = [];

  // core identity & strict rules 
  parts.push(
    `You are Curastra's personal health assistant. You help patients understand their care plans, medications, and health data.

STRICT RULES:
- Never diagnose conditions, diseases, or medical causes.
- Never recommend starting, stopping, or changing medication doses.
- Never interpret symptoms as a specific medical diagnosis.
- For anything urgent or severe, always advise: "Please consult your doctor or seek emergency care immediately."
- Keep responses concise, warm, empathetic, and in plain language.
- Base answers on the patient's provided health data whenever relevant.
- If you don't have information about something, state so clearly.`
  );

  // patient profile 
  if (context.profile_summary) {
    const p = context.profile_summary;
    const profileLine = [
      p.name && `Name: ${p.name}`,
      p.age && `Age: ${p.age}`,
      p.gender && `Gender: ${p.gender}`,
      p.blood_group && `Blood group: ${p.blood_group}`,
    ]
      .filter(Boolean)
      .join(", ");
    if (profileLine) {
      parts.push(`\nPATIENT PROFILE: ${profileLine}`);
    }
  }

  // active medications 
  if (context.medications && context.medications.length > 0) {
    const medLines = context.medications
      .slice(0, 8)
      .map(
        (m) =>
          `• ${m.name}${m.dosage ? ` (${m.dosage})` : ""}${
            m.frequency ? ` — ${m.frequency}` : ""
          }${m.timing ? `, ${m.timing}` : ""}`
      )
      .join("\n");
    parts.push(`\nCURRENT MEDICATIONS:\n${medLines}`);
  } else if (context.medications) {
    parts.push(`\nCURRENT MEDICATIONS: None recorded`);
  }

  // care plan summary 
  if (context.active_care_plan_summary) {
    const cp = context.active_care_plan_summary;
    const daysRem = cp.days_remaining > 0 ? `, ${cp.days_remaining} days remaining` : "";
    parts.push(
      `\nACTIVE CARE PLAN: ${cp.summary || "In progress"}\nProgress: ${
        cp.progress_percentage || 0
      }% complete${daysRem}`
    );
  } else if (context.active_care_plan_full) {
    const cp = context.active_care_plan_full;
    const taskSummary =
      cp.tasks && cp.tasks.length > 0
        ? `\nToday's tasks: ${cp.tasks.slice(0, 3).map((t) => t.title).join(", ")}`
        : "";
    parts.push(
      `\nACTIVE CARE PLAN: ${cp.summary || "In progress"}\nProgress: ${
        cp.progress_percentage || 0
      }% complete${taskSummary}`
    );
  }

  // symptoms to watch 
  if (
    context.active_care_plan_watch_symptoms &&
    context.active_care_plan_watch_symptoms.length > 0
  ) {
    const symptoms = context.active_care_plan_watch_symptoms
      .slice(0, 5)
      .map((s) => {
        if (typeof s === "string") return `• ${s}`;
        return `• ${s.symptom || s.title || JSON.stringify(s)} (${
          s.severity || "monitor"
        })`;
      })
      .join("\n");
    parts.push(`\nSYMPTOMS TO WATCH:\n${symptoms}`);
  }

  // diet recommendations 
  if (context.diet_recommendations && context.diet_recommendations.length > 0) {
    const diet = context.diet_recommendations
      .slice(0, 4)
      .map((d) => (typeof d === "string" ? `• ${d}` : `• ${d.item || d.title || d.recommendation || JSON.stringify(d)}`))
      .join("\n");
    parts.push(`\nDIET GUIDANCE:\n${diet}`);
  }

  // lifestyle recommendations 
  if (
    context.lifestyle_recommendations &&
    context.lifestyle_recommendations.length > 0
  ) {
    const lifestyle = context.lifestyle_recommendations
      .slice(0, 3)
      .map((l) => (typeof l === "string" ? `• ${l}` : `• ${l.recommendation || l.item || l.title || JSON.stringify(l)}`))
      .join("\n");
    parts.push(`\nLIFESTYLE GUIDANCE:\n${lifestyle}`);
  }

  // follow-up appointments 
  if (
    context.follow_up_appointments &&
    context.follow_up_appointments.length > 0
  ) {
    const pending = context.follow_up_appointments
      .filter((f) => !f.is_completed)
      .slice(0, 3)
      .map((f) =>
        typeof f === "string"
          ? `• ${f}`
          : `• ${f.description || f.title || "Follow-up"}${
              f.due_date ? ` — due ${f.due_date}` : ""
            }`
      )
      .join("\n");
    if (pending) {
      parts.push(`\nPENDING FOLLOW-UPS:\n${pending}`);
    }
  }

  // recent vitals 
  if (context.recent_vitals && context.recent_vitals.length > 0) {
    const vitals = context.recent_vitals
      .slice(0, 5)
      .map((v) => {
        const val = v.value_secondary
          ? `${v.value_primary}/${v.value_secondary}`
          : v.value_primary;
        return `• ${v.type.replace(/_/g, " ")}: ${val} ${v.unit}`;
      })
      .join("\n");
    parts.push(`\nRECENT METRICS:\n${vitals}`);
  }

  // abnormal lab results 
  if (context.lab_results_summary && context.lab_results_summary.length > 0) {
    const labs = context.lab_results_summary
      .slice(0, 5)
      .map(
        (l) =>
          `• ${l.parameter}: ${l.value} ${l.unit || ""} [${l.status || "abnormal"}]`
      )
      .join("\n");
    parts.push(`\nABNORMAL LAB RESULTS:\n${labs}`);
  }

  // disclaimer at end
  parts.push(
    `\nAlways end responses with: "\n\nThis is not medical advice. Consult your doctor for medical decisions."`
  );

  return parts.join("\n");
};


// formats conversation history array for LLM request
const buildMessageHistory = (history = [], newMessage) => {
  const messages = history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  if (newMessage) {
    messages.push({
      role: "user",
      content: newMessage,
    });
  }

  return messages;
};

module.exports = {
  buildSystemPrompt,
  buildMessageHistory,
};
