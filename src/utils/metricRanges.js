// universal reference ranges & status evaluator for self-monitored metrics ("My Metrics")
// evaluates readings into: 'in_range', 'borderline', 'high', 'low'

const METRIC_RANGES = {
  blood_glucose: {
    name: "Blood Glucose",
    unit: "mg/dL",
    min: 70,
    max: 140,
    evaluate: (val) => {
      if (val < 70) return "low";
      if (val > 140) return "high";
      if (val >= 100 && val <= 140) return "borderline"; // pre-diabetic fasting/postprandial range
      return "in_range";
    },
  },
  blood_pressure: {
    name: "Blood Pressure",
    unit: "mmHg",
    minSystolic: 90,
    maxSystolic: 120,
    minDiastolic: 60,
    maxDiastolic: 80,
    evaluate: (sys, dia) => {
      if (!sys) return "in_range";
      if (sys > 140 || (dia && dia > 90)) return "high";
      if (sys < 90 || (dia && dia < 60)) return "low";
      if ((sys >= 120 && sys <= 139) || (dia && dia >= 80 && dia <= 89)) return "borderline"; // elevated / prehypertension
      return "in_range";
    },
  },
  heart_rate: {
    name: "Heart Rate",
    unit: "bpm",
    min: 60,
    max: 100,
    evaluate: (val) => {
      if (val < 60) return "low";
      if (val > 100) return "high";
      return "in_range";
    },
  },
  oxygen_saturation: {
    name: "Oxygen Saturation (SpO2)",
    unit: "%",
    min: 95,
    max: 100,
    evaluate: (val) => {
      if (val < 92) return "low";
      if (val >= 92 && val < 95) return "borderline";
      return "in_range";
    },
  },
  temperature: {
    name: "Temperature",
    unit: "°F",
    min: 97.0,
    max: 99.0,
    evaluate: (val) => {
      if (val < 97.0) return "low";
      if (val > 99.0) return "high";
      if (val > 98.6 && val <= 99.5) return "borderline";
      return "in_range";
    },
  },
  weight: {
    name: "Weight",
    unit: "kg",
    evaluate: () => "in_range",
  },
};

// normalizes status string across lab parameters and vitals.
// maps 'normal' -> 'in_range', and preserves 'high', 'low', 'borderline'.
const normalizeStatus = (status) => {
  if (!status) return "in_range";
  const s = status.toLowerCase();
  if (s === "normal" || s === "in_range") return "in_range";
  if (s === "borderline") return "borderline";
  if (s === "high") return "high";
  if (s === "low") return "low";
  return "in_range";
};


// evaluates a metric reading and returns status ('in_range' | 'borderline' | 'high' | 'low')
const evaluateMetricStatus = (metricType, valuePrimary, valueSecondary) => {
  const config = METRIC_RANGES[metricType];
  if (!config) return "in_range";

  const primaryNum = parseFloat(valuePrimary);
  const secondaryNum = valueSecondary ? parseFloat(valueSecondary) : null;

  if (isNaN(primaryNum)) return "in_range";

  if (metricType === "blood_pressure") {
    return config.evaluate(primaryNum, secondaryNum);
  }

  return config.evaluate(primaryNum);
};

module.exports = {
  METRIC_RANGES,
  evaluateMetricStatus,
  normalizeStatus,
};
