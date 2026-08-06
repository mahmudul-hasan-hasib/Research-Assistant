import { create } from "zustand";

import type { TokenPair, User } from "@/types/api";
import { logger } from "@/lib/logger";

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  status: AuthStatus;
  setSession: (pair: TokenPair) => void;
  setTokens: (pair: Pick<TokenPair, "access_token" | "refresh_token" | "expires_in">) => void;
  setUser: (user: User) => void;
  setStatus: (status: AuthStatus) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  status: "idle",

  setSession: (pair) => {
    logger.info("auth.session_established", { userId: pair.user.id });
    set({
      accessToken: pair.access_token,
      refreshToken: pair.refresh_token,
      user: pair.user,
      status: "authenticated",
    });
  },

  setTokens: (pair) => {
    set({ accessToken: pair.access_token, refreshToken: pair.refresh_token });
  },

  setUser: (user) => set({ user }),

  setStatus: (status) => set({ status }),

  clearSession: () => {
    logger.info("auth.session_cleared");
    set({ accessToken: null, refreshToken: null, user: null, status: "unauthenticated" });
  },
}));
