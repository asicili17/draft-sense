import { ProviderError, type ProviderErrorCode } from "./ports";
export async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ProviderError("UNAVAILABLE", "Provider request failed.");
  }
  if (!response.ok) {
    const code: ProviderErrorCode =
      response.status === 401 || response.status === 403
        ? "AUTHENTICATION_FAILED"
        : response.status === 429
          ? "RATE_LIMITED"
          : "UNAVAILABLE";
    throw new ProviderError(code, `Provider returned HTTP ${response.status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new ProviderError("INVALID_RESPONSE", "Provider returned invalid JSON.");
  }
}
