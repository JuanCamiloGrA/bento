export type ApiClientOptions = {
  baseUrl?: string;
  fetcher?: typeof fetch;
};

export type RequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown>;
};

export class ApiError extends Error {
  readonly details: unknown;
  readonly status: number;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function resolveApiBaseUrl(explicitBaseUrl?: string): string {
  const configuredBaseUrl = explicitBaseUrl ?? import.meta.env.VITE_API_BASE_URL ?? "/api";
  const normalizedBaseUrl = configuredBaseUrl.trim() || "/api";

  return normalizedBaseUrl.replace(/\/+$/, "");
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = resolveApiBaseUrl(options.baseUrl);
  const fetcher = options.fetcher ?? fetch;

  async function request<TResponse>(path: string, requestOptions: RequestOptions = {}): Promise<TResponse> {
    const { body, headers, ...init } = requestOptions;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const requestHeaders = new Headers(headers);
    let requestBody: BodyInit | undefined;

    if (body === undefined) {
      requestBody = undefined;
    } else if (isBodyInit(body)) {
      requestBody = body;
    } else {
      requestHeaders.set("content-type", "application/json");
      requestBody = JSON.stringify(body);
    }

    const response = await fetcher(`${baseUrl}${normalizedPath}`, {
      ...init,
      body: requestBody,
      headers: requestHeaders,
    });

    if (!response.ok) {
      const details = await readResponseBody(response);
      throw new ApiError(response.statusText || "API request failed", response.status, details);
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await readResponseBody(response)) as TResponse;
  }

  return {
    baseUrl,
    request,
  };
}

export const apiClient = createApiClient();

function isBodyInit(body: BodyInit | Record<string, unknown>): body is BodyInit {
  return (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof ReadableStream
  );
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}
