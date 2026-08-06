import { apiClient } from "./api-client";
import { endpoints } from "./endpoints";
import type { TokenPair, User } from "@/types/api";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  display_name: string;
}

export const authService = {
  async login(input: LoginInput): Promise<TokenPair> {
    const { data } = await apiClient.post<TokenPair>(endpoints.auth.login, input);
    return data;
  },

  async register(input: RegisterInput): Promise<TokenPair> {
    const { data } = await apiClient.post<TokenPair>(endpoints.auth.register, input);
    return data;
  },

  async refresh(refreshToken: string): Promise<TokenPair> {
    const { data } = await apiClient.post<TokenPair>(endpoints.auth.refresh, {
      refresh_token: refreshToken,
    });
    return data;
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post(endpoints.auth.logout, { refresh_token: refreshToken });
  },

  async logoutAll(): Promise<void> {
    await apiClient.post(endpoints.auth.logoutAll);
  },

  async me(): Promise<User> {
    const { data } = await apiClient.get<User>(endpoints.auth.me);
    return data;
  },
};
