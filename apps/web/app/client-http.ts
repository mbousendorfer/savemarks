export async function responseErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Error responses are not required to contain JSON.
  }
  return fallback;
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallback: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new Error("SaveMarks could not reach the server.");
  }
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, fallback));
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("SaveMarks received an invalid server response.");
  }
}
