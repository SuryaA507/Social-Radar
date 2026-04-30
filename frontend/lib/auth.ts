export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  email: string;
  username: string;
}

export interface SignupPayload {
  email: string;
  username: string;
  password: string;
  full_name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// Auth API functions
export async function signup(apiBase: string, payload: SignupPayload): Promise<AuthResponse> {
  const response = await fetch(`${apiBase}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Signup failed");
  }

  return response.json() as Promise<AuthResponse>;
}

export async function login(apiBase: string, payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Login failed");
  }

  return response.json() as Promise<AuthResponse>;
}

export async function getCurrentUser(apiBase: string, token: string): Promise<User> {
  const response = await fetch(`${apiBase}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  return response.json() as Promise<User>;
}

// Token storage
export function saveToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function removeToken(): void {
  localStorage.removeItem("auth_token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
