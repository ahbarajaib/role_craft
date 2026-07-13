"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

export interface User {
  id: number;
  email: string;
  provider: string;
  credits: number;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("rc_token");
    if (savedToken) {
      setToken(savedToken);
      fetchMe(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchMe = async (authToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        logout();
      }
    } catch (err) {
      console.error("Error loading user profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data?.error?.detail || "Invalid email or password.");
    }

    const data = await response.json();
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem("rc_token", data.access_token);
    setShowAuthModal(false);
  };

  const signup = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data?.error?.detail || "Registration failed.");
    }

    const data = await response.json();
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem("rc_token", data.access_token);
    setShowAuthModal(false);
  };

  const googleLogin = async (credential: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data?.error?.detail || "Google authentication failed.");
    }

    const data = await response.json();
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem("rc_token", data.access_token);
    setShowAuthModal(false);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("rc_token");
  };

  const refreshMe = async () => {
    if (token) {
      await fetchMe(token);
    }
  };

  const authValue: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    signup,
    googleLogin,
    logout,
    refreshMe,
    showAuthModal,
    setShowAuthModal,
  };

  if (GOOGLE_CLIENT_ID) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
      </GoogleOAuthProvider>
    );
  }

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
