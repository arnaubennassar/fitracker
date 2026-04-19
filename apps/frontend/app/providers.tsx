"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { ApiError, getAuthSession, logoutUser } from "./_lib/api";
import type { AuthSession } from "./_lib/types";

type SessionContextValue = {
  errorMessage: string | null;
  loading: boolean;
  refreshSession: () => Promise<AuthSession | null>;
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const nextSession = await getAuthSession();
      setSession(nextSession);
      setErrorMessage(null);
      return nextSession;
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Could not load the session.",
      );
      setSession(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  async function signOut() {
    await logoutUser();
    setSession({
      authenticated: false,
      session: null,
      user: null,
    });
  }

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  return (
    <SessionContext.Provider
      value={{
        errorMessage,
        loading,
        refreshSession,
        session,
        setSession,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within AppProviders.");
  }

  return context;
}
