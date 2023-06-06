/* eslint-disable @typescript-eslint/no-explicit-any */
import { AxiosError } from "axios";
import { LocalStorage } from "quasar";

import { api } from "src/boot/axios";
import { GENERIC_ERROR_MESSAGE_NETWORK_ERROR } from "src/constants";
import { sse } from "src/helpers/sse";

export async function signIn({ commit }: any, { data }: any) {
  try {
    const response = await api.post("/imap/login", data);

    LocalStorage.set("imapCredentials", data);
    commit("SET_IMAP_CREDENTIALS", data);
    commit("SET_INFO_MESSAGE", response.data.data.message);
  } catch (err) {
    if (err !== null && err instanceof AxiosError) {
      let message = null;
      const error = err.response?.data?.error || err;
      const fieldErrors = error.errors;

      if (error.message?.toLowerCase() === "network error") {
        message = GENERIC_ERROR_MESSAGE_NETWORK_ERROR;
      } else {
        message = error.message;
      }

      if (fieldErrors) {
        commit("SET_ERRORS", fieldErrors);
        commit("SET_ERROR", null);
      } else {
        commit("SET_ERROR", message);
        commit("SET_ERRORS", {});
      }
    }

    throw err;
  }
}

export async function getBoxes({ getters, commit }: any) {
  commit("SET_LOADINGBOX", true);
  const user = getters.getCurrentUser;

  try {
    const params = {
      access_token: user.providerToken,
      email: user.email,
      host: user.host,
      password: user.password,
      port: user.port,
    };

    const headers = {
      Authorization: `Bearer ${user.accessToken}`,
      "X-imap-credentials": JSON.stringify(params),
    };
    const response = await api.get(`/imap/${user.id}/boxes`, { headers });

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
        message = GENERIC_ERROR_MESSAGE_NETWORK_ERROR;
      } else {
        message = error.message;
      }

      commit("SET_ERROR", message);
    }
    throw err;
  }
}

export async function startMining(
  this: any,
  { getters, commit }: any,
  { data }: any
) {
  const user = getters.getCurrentUser;

  commit("SET_LOADING", true);
  commit("SET_LOADING_DNS", true);
  commit("SET_SCANNEDEMAILS", 0);
  commit("SET_EXTRACTEDEMAILS", 0);
  commit("SET_STATISTICS", "f");
  commit("SET_SCANNEDBOXES", []);

  try {
    const { boxes } = data;
    const body = {
      access_token: user.providerToken,
      email: user.email,
      host: user.host,
      password: user.password,
      port: user.port,
      boxes,
    };
    const headers = {
      Authorization: `Bearer ${user.accessToken}`,
    };
    const response = await api.post(`/imap/mine/${user.id}`, body, { headers });

    const task = response.data?.data?.task;
    const { miningId } = task;

    sse.initConnection(user.id, miningId);
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
        message = GENERIC_ERROR_MESSAGE_NETWORK_ERROR;
      } else {
        message = error.message;
      }

      commit("SET_ERROR", message);
    }
    throw err;
  }
}

export async function stopMining({ commit, getters }: any, { data }: any) {
  try {
    const user = getters.getCurrentUser;
    const { miningId } = data;
    const headers = {
      Authorization: `Bearer ${user.accessToken}`,
    };
    await api.delete(`/imap/mine/${user.id}/${miningId}`, { headers });

    commit("DELETE_MINING_TASK");
    commit("SET_STATUS", "");
    commit("SET_INFO_MESSAGE", "Mining has stopped");
  } catch (err) {
    if (err !== null && err instanceof AxiosError) {
      let message = null;
      const error = err.response?.data?.error || err;

      if (error.message?.toLowerCase() === "network error") {
        message = GENERIC_ERROR_MESSAGE_NETWORK_ERROR;
      } else {
        message = error.message;
      }

      commit("SET_ERROR", message);
    }
    throw err;
  }
}
