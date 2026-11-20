const RENDER_BACKEND_URL = "https://omnilogic-backend.onrender.com";
const envApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export const PRIMARY_API_URL = envApiUrl || RENDER_BACKEND_URL;

export const API_HOSTS = [
  PRIMARY_API_URL,
  RENDER_BACKEND_URL,
  "http://127.0.0.1:8000",
  "http://localhost:8000",
];
