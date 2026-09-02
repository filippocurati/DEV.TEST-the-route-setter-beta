/** Tolleranze geometriche centralizzate e indipendenti dal frame rate. */
export const GEOMETRY_CONFIG = Object.freeze({
  collisionMarginMeters: 0.001,
  supportToleranceMeters: 0.001,
  seamWeldMeters: 0.0001,
  normalEpsilon: 1e-30,
  normalChangeRadians: Math.PI / 360,
  maximumRotationSubstepRadians: Math.PI / 90,
  maximumTranslationSubstepMeters: 0.005,
  maximumFractionIterations: 14,
  maximumTransitionsPerStep: 128,
});
