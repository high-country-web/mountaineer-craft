import { config } from "../config.js";

function isJSON(response: Response): boolean {
  const type = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
  return /^application\/(?:[\w.-]+\+)?json$/i.test(type);
}

export class PlayerAnalyticsClient {
  private cookie: string | null = null;
  private loginPromise: Promise<void> | null = null;

  private baseUrl = config.PLAYER_ANALYTICS_URL!.replace(/\/+$/, "");
  private user = config.PLAYER_ANALYTICS_USERNAME!;
  private password = config.PLAYER_ANALYTICS_PASSWORD!;

  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      // Fetch errors can include URLs. Never forward credentials or upstream bodies.
      throw new Error("Plan API connection failed or timed out");
    }
  }

  async login(): Promise<void> {
    if (this.loginPromise) return this.loginPromise;
    const pending = this.performLogin();
    this.loginPromise = pending;
    try {
      await pending;
    } finally {
      if (this.loginPromise === pending) this.loginPromise = null;
    }
  }

  private async performLogin(): Promise<void> {
    this.cookie = null;
    const response = await this.fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ user: this.user, password: this.password }),
    });
    if (!response.ok) throw new Error(`Plan API login failed: HTTP ${response.status}`);
    if (!isJSON(response)) {
      throw new Error("Plan API login returned a non-JSON page; check the Plan URL or proxy");
    }
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new Error("Plan API login returned invalid JSON");
    }
    if (
      !result ||
      typeof result !== "object" ||
      !("success" in result) ||
      result.success !== true
    ) {
      throw new Error("Plan API login rejected the configured credentials");
    }
    const cookie = response.headers.getSetCookie().find((value) => /^auth=/i.test(value));
    if (!cookie) throw new Error("Plan API login did not return an auth cookie");
    this.cookie = cookie.split(";")[0];
  }

  async request(endpoint: string): Promise<Response> {
    if (!this.cookie) await this.login();
    for (let attempt = 0; attempt < 2; attempt++) {
      const sentCookie = this.cookie!;
      const response = await this.fetch(endpoint, {
        headers: { Cookie: sentCookie, Accept: "application/json" },
      });
      const redirected = response.status >= 300 && response.status < 400;
      const authRequired = response.status === 401 || response.status === 403;
      const unexpectedPage = response.ok && !isJSON(response);
      if (redirected || authRequired || unexpectedPage) {
        await response.body?.cancel();
        if (attempt === 0) {
          // A different concurrent request may already have refreshed this cookie.
          if (this.cookie === sentCookie || !this.cookie) await this.login();
          continue;
        }
        if (this.cookie === sentCookie) this.cookie = null;
        if (authRequired) {
          throw new Error(
            `Plan API access denied after login: HTTP ${response.status}; check account permissions`,
          );
        }
        throw new Error(
          "Plan API still returned a redirect or non-JSON page after login; check the Plan URL or proxy",
        );
      }
      if (!response.ok) throw new Error(`Plan API request failed: HTTP ${response.status}`);
      try {
        // Preserve the existing Response API for callers, but reject malformed
        // payloads here without putting HTML or sensitive response data in logs.
        await response.clone().json();
      } catch {
        throw new Error("Plan API returned invalid JSON");
      }
      return response;
    }
    throw new Error("Plan API request could not recover");
  }
}

export default new PlayerAnalyticsClient();
