const ENV_EMAIL = process.env.NEXT_PUBLIC_API_EMAIL || 'test@example.com';
const ENV_PASSWORD = process.env.NEXT_PUBLIC_API_PASSWORD || 'hunter2';

export async function loginWithEnvCredentials() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ identifier: ENV_EMAIL, password: ENV_PASSWORD }),
  });
  if (!res.ok) throw new Error('Login failed');
  return await res.json();
}


export async function fetchWithRefresh(path: string, options: RequestInit = {}) {
  const authDetails = await loginWithEnvCredentials();
console.log(options); console.log(authDetails);
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authDetails.access_token}`,
      ...(options.headers || {}),
    },
  });

  return res;
}
