// The backend has no CORS and no /api prefix, so the dev and preview servers
// forward /api/* to it with the prefix stripped. Port matches apps/backend/.env.example.
export const API_PROXY_TARGET = "http://localhost:3000";

export function apiProxyRewrite(path: string): string {
  return path.replace(/^\/api/, "");
}

export const apiProxy = {
  "/api": {
    target: API_PROXY_TARGET,
    changeOrigin: true,
    rewrite: apiProxyRewrite,
  },
};
