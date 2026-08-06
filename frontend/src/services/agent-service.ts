import { apiClient } from "./api-client";
import { endpoints } from "./endpoints";
import type { AgentRunResponse } from "@/types/api";

export const agentService = {
  async run(query: string): Promise<AgentRunResponse> {
    const { data } = await apiClient.post<AgentRunResponse>(endpoints.agent.run, { query });
    return data;
  },
};
