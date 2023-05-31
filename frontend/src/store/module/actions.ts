/* eslint-disable @typescript-eslint/no-explicit-any */
import { LocalStorage } from "quasar";

import { api } from "src/boot/axios";
import { GENERIC_ERROR_MESSAGE_NETWORK_ERROR } from "src/constants";
import { sse } from "src/helpers/sse";

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
    const params = {
      id: user.id,
      email: user.email,
      access_token: user.accessToken,
      host: user.host,
      password: user.password,
      port: user.port,
    };
    const response = await api.post(
      `/imap/mine/${user.id}`,
      { boxes },
      { headers: { "X-imap-login": JSON.stringify(params) } }
    );

    const task = response.data?.data?.task;
    const { userId, miningId } = task;

    sse.initConnection(userId, miningId);
    sse.registerEventHandlers(miningId, this);

    commit("SET_MINING_TASK", task);
    commit("SET_LOADING", false);
    commit("SET_LOADING_DNS", false);
    commit("SET_STATUS", "");
    commit("SET_INFO_MESSAGE", "Mining has been started");
  } catch (err: any) {
    sse.closeConnection();
    const error = err.response?.data?.error || err;
    const message =
      error.message.toLowerCase() === "network error"
        ? GENERIC_ERROR_MESSAGE_NETWORK_ERROR
        : error.message;

    commit("SET_ERROR", message);
    throw new Error(message);
  }
}

export async function stopMining({ commit, getters }: any, { data }: any) {
  try {
    const user = getters.getCurrentUser;
    const { miningId } = data;
    const params = {
      id: user.id,
      email: user.email,
      access_token: user.accessToken,
      host: user.host,
      password: user.password,
      port: user.port,
    };
    await api.delete(`/imap/mine/${user.id}/${miningId}`, {
      headers: { "X-imap-login": JSON.stringify(params) },
    });

    commit("DELETE_MINING_TASK");
    commit("SET_STATUS", "");
    commit("SET_INFO_MESSAGE", "Mining has been stopped");
  } catch (err: any) {
    const error = err.response?.data?.error || err;
    const message =
      error.message.toLowerCase() === "network error"
        ? GENERIC_ERROR_MESSAGE_NETWORK_ERROR
        : error.message;
    commit("SET_ERROR", message);
    throw new Error(message);
  }
}

export async function signIn({ commit }: any, { data }: any) {
  try {
    const response = await api.post("/imap/login", data);
    const imapUser = { ...response.data.imap, password: data.password };

    LocalStorage.set("user", imapUser);
    commit("SET_USER_CREDENTIALS", imapUser);

    return response.data;
  } catch (err: any) {
    const error = err.response?.data?.error || err;
    const fieldErrors = error.errors;
    const message =
      error.message.toLowerCase() === "network error"
        ? GENERIC_ERROR_MESSAGE_NETWORK_ERROR
        : error.message;

    if (fieldErrors) {
      commit("SET_ERRORS", fieldErrors);
      commit("SET_ERROR", null);
    } else {
      commit("SET_ERROR", message);
      commit("SET_ERRORS", {});
    }

    throw new Error(err);
  }
}

export async function getBoxes({ getters, commit }: any) {
  commit("SET_LOADINGBOX", true);
  const user = getters.getCurrentUser;
  commit("SET_USERID", user.id);

  try {
    const params = {
      id: user.id,
      email: user.email,
      access_token: user.accessToken,
      host: user.host,
      password: user.password,
      port: user.port,
    };
    const { data } = await api.get("/imap/1/boxes", {
      headers: { "X-imap-login": JSON.stringify(params) },
    });

    commit("SET_LOADINGBOX", false);
    commit("SET_BOXES", data.imapFoldersTree);
    commit("SET_INFO_MESSAGE", "Successfully retrieved IMAP boxes.");
  } catch (err: any) {
    const error = err.response?.data?.error || err;
    const message =
      error.message.toLowerCase() === "network error"
        ? GENERIC_ERROR_MESSAGE_NETWORK_ERROR
        : error.message;

    commit("SET_ERROR", message);
    throw new Error(err);
  }
}
