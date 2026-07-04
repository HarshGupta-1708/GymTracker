import { getTrackingType } from "../constants/data";

export const FIELD_TEMPLATES = {
  strength: [
    { key: "w", label: "Weight", unit: "kg" },
    { key: "r", label: "Reps", unit: "" },
  ],
  cardio: [
    { key: "durMin", label: "Duration", unit: "min" },
    { key: "distKm", label: "Distance", unit: "km" },
  ],
  duration: [
    { key: "durMin", label: "Duration", unit: "min" },
  ],
};

export const getDefaultFieldsForCategory = (category = "") => {
  if (category === "Cardio") return [...FIELD_TEMPLATES.cardio];
  if (category === "Recovery") return [...FIELD_TEMPLATES.duration];
  return [...FIELD_TEMPLATES.strength];
};

export const getExerciseFields = (exercise) => {
  if (exercise?.fields?.length) return exercise.fields;
  const tracking = getTrackingType(exercise?.name, exercise?.category);
  return FIELD_TEMPLATES[tracking] || FIELD_TEMPLATES.strength;
};

export const slugifyFieldKey = (label) => {
  const base = String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  return base || `field_${Date.now()}`;
};

export const formatSetFieldValue = (field, value) => {
  if (value === undefined || value === null || value === "") return "-";
  const num = parseFloat(value);
  if (Number.isNaN(num)) return String(value);
  if (field.key === "w" && num === 0) return "BW";
  if (field.unit) {
    const u = field.unit.trim();
    if (u === "kg") return `${num}kg`;
    if (u === "degree" || u === "°") return `${num}°`;
    return `${num} ${u}`;
  }
  return String(num);
};

export const getFieldsForSetDisplay = (exercise, set) => {
  const defined = getExerciseFields(exercise);
  const definedKeys = new Set(defined.map((f) => f.key));
  const extraKeys = Object.keys(set || {}).filter(
    (k) => k !== "t" && !definedKeys.has(k),
  );
  const extraFields = extraKeys.map((k) => ({
    key: k,
    label: k.replace(/_/g, " "),
    unit: "",
  }));
  return [...defined, ...extraFields];
};

export const getDisplayFieldsForExercise = (exercise, workoutExercise) => {
  const base = getExerciseFields(
    exercise || { name: workoutExercise?.name, category: "Custom" },
  );
  const baseKeys = new Set(base.map((f) => f.key));
  const extraKeys = new Set();
  (workoutExercise?.sets || []).forEach((set) => {
    Object.keys(set || {})
      .filter((k) => k !== "t" && !baseKeys.has(k))
      .forEach((k) => extraKeys.add(k));
  });
  const extras = [...extraKeys].map((k) => ({
    key: k,
    label: k.replace(/_/g, " "),
    unit: "",
  }));
  return [...base, ...extras];
};

export const formatSetSummary = (fields, set) => {
  return fields
    .map((f) => {
      const val = formatSetFieldValue(f, set[f.key]);
      if (val === "-") return null;
      return `${f.label}: ${val}`;
    })
    .filter(Boolean)
    .join("  ·  ");
};

export const validateSetFields = (fields, values) => {
  const hasAny = fields.some((f) => {
    const v = values[f.key];
    return v !== undefined && v !== null && v !== "" && parseFloat(v) > 0;
  });
  if (!hasAny) return "Enter at least one value";
  for (const f of fields) {
    const v = values[f.key];
    if (f.key === "r" && v !== undefined && v !== "" && !(parseInt(v) > 0)) {
      return "Enter reps";
    }
  }
  return null;
};

export const buildSetFromFields = (fields, values) => {
  const set = { t: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) };
  fields.forEach((f) => {
    const raw = values[f.key];
    if (raw === undefined || raw === "") return;
    set[f.key] = f.key === "r" ? parseInt(raw) || 0 : parseFloat(raw) || 0;
  });
  return set;
};
