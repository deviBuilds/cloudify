const INFRA_AGENT_URL = process.env.INFRA_AGENT_URL || "http://localhost:4000";
const INFRA_AGENT_SECRET = process.env.INFRA_AGENT_SECRET || "";

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${INFRA_AGENT_SECRET}`,
  };

  const options: RequestInit = { method, headers, cache: "no-store" };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${INFRA_AGENT_URL}${path}`, options);

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Infra API error ${res.status}: ${errorBody}`);
  }

  return res.json() as Promise<T>;
}

export const infraApi = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
