// Design tokens exposed to JavaScript (charts, canvas, computed styles).
// Keep in sync with @theme block in src/index.css — that CSS block is the source of truth.

export const colors = {
  ink: "#0E0E10",
  paper: "#F4EFE6",
  bone: "#EAE3D2",
  boneStrong: "#D8D0BC",
  muted: "#6B655A",
  pulse: "#E85D2F",
  status: {
    up: "#2E6B4E",
    degraded: "#C7902D",
    down: "#B23A2A",
    maintenance: "#4A5560",
  },
};

// Reads a live CSS variable so charts follow dark-mode swaps automatically.
export const readVar = (name) => {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
