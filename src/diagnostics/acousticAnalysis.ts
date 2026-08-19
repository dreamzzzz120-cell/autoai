export type AcousticFeatures = { rms: number; peak: number; crestFactor: number; spectralCentroidHz: number; dominantFrequencyHz: number; durationSeconds: number };

export function validateAcousticFeatures(features: AcousticFeatures) {
  for (const value of Object.values(features)) {
    if (!Number.isFinite(value) || value < 0) throw new Error("Invalid acoustic feature");
  }
  if (features.durationSeconds > 300) throw new Error("Audio sample exceeds diagnostic limit");
  return features;
}

/**
 * Safety boundary: features are observations, not diagnoses. A trained model
 * must be benchmarked against labeled mechanical recordings before any feature
 * is converted into a component hypothesis.
 */
export function acousticEvidenceLabel(features: AcousticFeatures) {
  validateAcousticFeatures(features);
  return { level: "observed_acoustic_features" as const, features, diagnosisAllowed: false };
}
