import type { ProxyHostConfig, ProxyHost } from "./types.js";

export class NginxProxyManager {
  private url: string;
  private email: string;
  private password: string;
  private token: string | null = null;

  constructor({
    url,
    email,
    password,
  }: {
    url: string;
    email: string;
    password: string;
  }) {
    this.url = url;
    this.email = email;
    this.password = password;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.token) {
      await this.authenticate();
    }

    const doRequest = async (): Promise<Response> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      };

      const options: RequestInit = { method, headers };
      if (body) {
        options.body = JSON.stringify(body);
      }

      return fetch(`${this.url}/api${path}`, options);
    };

    let response = await doRequest();

    if (response.status === 401) {
      await this.authenticate();
      response = await doRequest();
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `NPM API error ${response.status} ${method} ${path}: ${errorBody}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async authenticate(): Promise<string> {
    const response = await fetch(`${this.url}/api/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: this.email,
        secret: this.password,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`NPM authentication failed: ${errorBody}`);
    }

    const data = (await response.json()) as { token: string };
    this.token = data.token;
    return this.token;
  }

  async createProxyHost(config: ProxyHostConfig): Promise<{ id: number }> {
    return this.request<{ id: number }>("POST", "/nginx/proxy-hosts", config);
  }

  async deleteProxyHost(id: number): Promise<void> {
    await this.request<void>("DELETE", `/nginx/proxy-hosts/${id}`);
  }

  async listProxyHosts(): Promise<ProxyHost[]> {
    return this.request<ProxyHost[]>("GET", "/nginx/proxy-hosts");
  }

  async findWildcardCert(domain: string): Promise<number | null> {
    const certs = await this.request<
      { id: number; domain_names: string[] }[]
    >("GET", "/nginx/certificates");

    const wildcardPattern = `*.${domain}`;
    const cert = certs.find((c) =>
      c.domain_names.includes(wildcardPattern),
    );

    return cert?.id ?? null;
  }
}
