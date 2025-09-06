// utils/apiBase.js
export const RESOLVE_API_BASE = () => {
  const fromEnv = import.meta?.env?.VITE_API_BASE;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  // Always use relative path so Vite proxy (dev) or same-origin (prod) handles it
  return "/api";
};
