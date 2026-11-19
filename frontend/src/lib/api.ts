const envApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export const PRIMARY_API_URL = envApiUrl || "http://127.0.0.1:8000";

export const API_HOSTS = envApiUrl
  ? [envApiUrl, "http://127.0.0.1:8000", "http://localhost:8000"]
  : ["http://127.0.0.1:8000", "http://localhost:8000"];
