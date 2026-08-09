

// local safety pre-screening module
// intercepts dangerous, diagnostic, or emergency queries before calling LLM
const SAFE_RESPONSES = {
  suicidal:
    "I'm concerned about you. Please reach out for immediate support from the following resources: " +
    "You can contact Tele-MANAS at 1-800-891-4416, iCall at 9152987821, or " +
    "the Vandrevala Foundation Helpline at 1860-2662-345. " +
    "If you feel you're in immediate danger or unable to stay safe, " +
    "please call your local emergency services or go to the nearest emergency department.",
  emergency:
    "This sounds like a medical emergency. Please call 112 immediately or go to the nearest emergency room.",
  diagnosis:
    "I'm not able to diagnose conditions. Please consult your doctor for a medical evaluation. I can help you understand your current care plan, medications, or vitals.",
  medication_change:
    "Changes to your medication should always be discussed with your doctor first. I can help you understand what your current medications are prescribed for.",
};

const screenMessage = (message) => {
  if (!message || typeof message !== "string") {
    return { blocked: false };
  }

  const text = message.trim();

  // suicidal ideation
  if (/\b(suicide|kill myself|end my life|want to die)\b/i.test(text)) {
    return {
      blocked: true,
      category: "suicidal",
      response: SAFE_RESPONSES.suicidal,
    };
  }

  // emergency situations
  if (
    /\b(chest pain|can't breathe|cannot breathe|heart attack|stroke|unconscious|severe bleeding)\b/i.test(
      text
    )
  ) {
    return {
      blocked: true,
      category: "emergency",
      response: SAFE_RESPONSES.emergency,
    };
  }

  // requests for diagnosis
  if (
    /\b(do i have|diagnose me|what disease|what condition|am i sick|is it cancer|is it serious)\b/i.test(
      text
    )
  ) {
    return {
      blocked: true,
      category: "diagnosis",
      response: SAFE_RESPONSES.diagnosis,
    };
  }

  // requests to change medication
  if (
    /\b(should i stop|can i stop|increase my dose|reduce my dose|change my medication|stop taking)\b/i.test(
      text
    )
  ) {
    return {
      blocked: true,
      category: "medication_change",
      response: SAFE_RESPONSES.medication_change,
    };
  }

  return { blocked: false };
};

module.exports = {
  screenMessage,
  SAFE_RESPONSES,
};
