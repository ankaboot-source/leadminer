/* eslint-disable @typescript-eslint/no-explicit-any */
import { AxiosError } from "axios";

import { api } from "src/boot/axios";
import { sse } from "src/helpers/sse";
import { supabase } from "src/helpers/supabase";
import { MiningSource } from "src/types/providers";

export async function getMiningSources({ commit }: any) {
  try {
    commit("setIsLoadingSources", true);
    const { data } = await api.get<{
      message: string;
      sources: MiningSource[];
    }>("/imap/mine/sources");
    commit("setMiningSources", data.sources);
    if (data.sources.length > 0) {
      commit("setActiveMiningSource", data.sources[0]);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    commit("setIsLoadingSources", false);
  }
}

export async function getBoxes({ commit }: any, miningSource: MiningSource) {
  commit("SET_LOADINGBOX", true);

  try {
    const response = await api.post("/imap/boxes", miningSource);

    const folders = response.data?.data?.folders;

    if (folders) {
      commit("SET_BOXES", folders);
      commit("SET_INFO_MESSAGE", "Successfully retrieved IMAP boxes.");
    }

    commit("SET_LOADINGBOX", false);
  } catch (err) {
    if (err !== null && err instanceof AxiosError) {
      let message = null;
      const error = err.response?.data?.error || err;

      if (error.message?.toLowerCase() === "network error") {
        message =
          "Unable to access server. Please retry again or contact your service provider.";
      } else {
        message = error.message;
      }

      commit("SET_ERROR", message);
    }
    throw err;
  } finally {
    commit("SET_LOADINGBOX", false);
  }
}

export async function startMining(this: any, { commit }: any, { data }: any) {
  commit("SET_LOADING", true);
  commit("SET_LOADING_DNS", true);
  commit("SET_SCANNEDEMAILS", 0);
  commit("SET_EXTRACTEDEMAILS", 0);
  commit("SET_STATISTICS", "f");
  commit("SET_SCANNEDBOXES", []);

  try {
    const { data: session } = await supabase.auth.getUser();

    if (!session.user) {
      return;
    }

    const response = await api.post(`/imap/mine/${session.user.id}`, data);

    const task = response.data?.data;
    const { miningId } = task;

    sse.initConnection(session.user?.id, miningId);
    sse.registerEventHandlers(miningId, this);

    commit("SET_MINING_TASK", task);
    commit("SET_LOADING", false);
    commit("SET_LOADING_DNS", false);
    commit("SET_STATUS", "");
    commit("SET_INFO_MESSAGE", "Mining has started");
  } catch (err) {
    sse.closeConnection();
    if (err !== null && err instanceof AxiosError) {
      let message = null;
      const error = err.response?.data?.error || err;

      if (error.message?.toLowerCase() === "network error") {
        message =
          "Unable to access server. Please retry again or contact your service provider.";
      } else {
        message = error.message;
      }

      commit("SET_ERROR", message);
    }
    throw err;
  }
}

export async function stopMining({ commit }: any, { data }: any) {
  try {
    const { data: session } = await supabase.auth.getUser();

    if (!session.user) {
      return;
    }
    const { miningId } = data;

    await api.delete(`/imap/mine/${session.user.id}/${miningId}`);

    commit("DELETE_MINING_TASK");
    commit("SET_STATUS", "");
    commit("SET_INFO_MESSAGE", "Mining has stopped");
  } catch (err) {
    if (err !== null && err instanceof AxiosError) {
      let message = null;
      const error = err.response?.data?.error || err;

      if (error.message?.toLowerCase() === "network error") {
        message =
          "Unable to access server. Please retry again or contact your service provider.";
      } else {
        message = error.message;
      }

      commit("SET_ERROR", message);
    }
    throw err;
  }
}
