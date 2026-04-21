"use client";

// biome-ignore lint/style/useImportType: Vitest needs a runtime React import for JSX in this file.
import React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { ApiError, getAuthSession, logoutUser } from "./_lib/api";
import { useForegroundRefresh } from "./_lib/foreground-refresh";
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
  const [sessionState, setSessionState] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const refreshRequestIdRef = useRef(0);
  const sessionMutationIdRef = useRef(0);

  const setSession = useCallback((nextSession: AuthSession | null) => {
    sessionMutationIdRef.current += 1;
    setSessionState(nextSession);
    setErrorMessage(null);
    setLoading(false);
  }, []);

  const refreshSession = useCallback(async () => {
    const requestId = refreshRequestIdRef.current + 1;
    const sessionMutationIdAtStart = sessionMutationIdRef.current;

    refreshRequestIdRef.current = requestId;

    try {
      const nextSession = await getAuthSession();

      if (
        refreshRequestIdRef.current !== requestId ||
        sessionMutationIdRef.current !== sessionMutationIdAtStart
      ) {
        return null;
      }

      setSessionState(nextSession);
      setErrorMessage(null);
      return nextSession;
    } catch (error) {
      if (
        refreshRequestIdRef.current !== requestId ||
        sessionMutationIdRef.current !== sessionMutationIdAtStart
      ) {
        return null;
      }

      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Could not load the session.",
      );
      setSessionState(null);
      return null;
    } finally {
      if (
        refreshRequestIdRef.current === requestId &&
        sessionMutationIdRef.current === sessionMutationIdAtStart
      ) {
        setLoading(false);
      }
    }
  }, []);

  async function signOut() {
    await logoutUser();
    setSession({
      authenticated: false,
      session: null,
    });
  }

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useForegroundRefresh({
    disabled: loading,
    intervalMs: 60_000,
    refresh: refreshSession,
  });

  return (
    <SessionContext.Provider
      value={{
        errorMessage,
        loading,
        refreshSession,
        session: sessionState,
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
