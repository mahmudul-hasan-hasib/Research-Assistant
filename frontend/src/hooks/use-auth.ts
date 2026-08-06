"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { useAuthStore } from "@/stores/auth-store";
import { authService, type LoginInput, type RegisterInput } from "@/services/auth-service";
import { queryKeys } from "@/lib/query-keys";

export function useAuth() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setStatus = useAuthStore((state) => state.setStatus);
  const clearSession = useAuthStore((state) => state.clearSession);

  // Restore a live session on mount (in-memory tokens, Part 3.7.4).
  useEffect(() => {
    if (!accessToken && !refreshToken) {
      setStatus("unauthenticated");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    authService
      .me()
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: (pair) => {
      setSession(pair);
      queryClient.clear();
    },
  });

  const register = useMutation({
    mutationFn: (input: RegisterInput) => authService.register(input),
    onSuccess: (pair) => {
      setSession(pair);
      queryClient.clear();
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      const token = useAuthStore.getState().refreshToken;
      if (token) {
        try {
          await authService.logout(token);
        } catch {
          // local session is cleared regardless of server result
        }
      }
      clearSession();
      queryClient.clear();
    },
  });

  const meQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: authService.me,
    enabled: Boolean(accessToken) && status === "authenticated",
  });

  const refreshUser = useCallback(async () => {
    const profile = await authService.me();
    setUser(profile);
    return profile;
  }, [setUser]);

  return {
    user,
    accessToken,
    isAuthenticated: status === "authenticated",
    isLoading: status === "idle" || status === "loading",
    login,
    register,
    logout,
    refreshUser,
    meQuery,
  };
}
