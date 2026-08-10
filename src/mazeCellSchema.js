// Suggested maze cell schema.
export const cell = (x, y, type, rotation = 0, extra = {}) => ({
  x, y, type, rotation, ...extra
});

// Rotation: 0/1/2/3 => 0/90/180/270 degrees.
// Connections should be resolved logically; artwork is visual-only.
