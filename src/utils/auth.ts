const ENV_EMAIL = process.env.NEXT_PUBLIC_API_EMAIL || 'test@example.com';
const ENV_PASSWORD = process.env.NEXT_PUBLIC_API_PASSWORD || 'hunter2';

export async function loginWithEnvCredentials() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email: ENV_EMAIL, password: ENV_PASSWORD }),
  });
  if (!res.ok) throw new Error('Login failed');
  return await res.json();
}

export async function refreshAccessToken() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (res.status === 401) {
    // Not logged in — try fresh login
    await loginWithEnvCredentials();

    // Retry refresh after login
    const retry = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!retry.ok) throw new Error('Refresh failed after login');
    return await retry.json();
  }

  if (!res.ok) throw new Error('Refresh failed');
  return await res.json();
}

export async function fetchWithRefresh(path: string, options: RequestInit = {}) {
  console.log(process.env);
  await refreshAccessToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
  });
  return res;
}
