// src/lib/animations.js
// Framer Motion presets for luxury, slow, and physics-based Apple-style animation curves

export const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } 
  }
};

export const slideInLeft = {
  initial: { opacity: 0, x: -50 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 1.0, ease: [0.16, 1, 0.3, 1] }
  }
};

export const glassCardHover = {
  hover: {
    y: -4,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8)",
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
  }
};

export const magneticPreset = {
  hover: {
    scale: 1.03,
    boxShadow: "0 0 20px rgba(134, 59, 255, 0.2)",
    borderColor: "rgba(134, 59, 255, 0.3)",
    transition: { type: "spring", stiffness: 300, damping: 20 }
  },
  tap: { scale: 0.98 }
};

export const containerStagger = {
  animate: {
    transition: {
      staggerChildren: 0.15
    }
  }
};
