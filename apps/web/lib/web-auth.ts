function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export function webCredentialsConfigured(): boolean {
  return Boolean(
    process.env.SAVEMARKS_WEB_USERNAME && process.env.SAVEMARKS_WEB_PASSWORD,
  );
}

export function validBasicAuthorization(authorization: string | null): boolean {
  if (!authorization?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return (
      constantTimeEqual(
        decoded.slice(0, separator),
        process.env.SAVEMARKS_WEB_USERNAME ?? "",
      ) &&
      constantTimeEqual(
        decoded.slice(separator + 1),
        process.env.SAVEMARKS_WEB_PASSWORD ?? "",
      )
    );
  } catch {
    return false;
  }
}
