// utils/auth.ts

const AUTH_TOKEN_KEY = 'access_token';

function getAuthToken(): string | null {
  try {
    return (
      localStorage.getItem(AUTH_TOKEN_KEY) ||
      sessionStorage.getItem(AUTH_TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

export async function fetchWithRefresh(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // ✅ Add Authorization header only if token is present
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers,
  });
}
