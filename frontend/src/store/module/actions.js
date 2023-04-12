import { LocalStorage } from "quasar";

import { createClient } from "@supabase/supabase-js";
import { sse } from "src/helpers/sse";
import { fetchData } from "src/helpers/supabase.js";

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SECRET_PROJECT_TOKEN
);

let subscription;

function subscribeToRefined(userId, commit) {
  subscription = supabase
    .channel("*")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "refinedpersons",
        filter: `userid=eq.${userId}`,
      },
      (payload) => {
        commit("SET_EMAILS", payload.new);
      }
    )
    .subscribe();
}
export async function syncRefinedPersons({ state, commit }) {
  if (subscription) {
    // Unsubscribe from real-time updates if currently subscribed
    // to avoid getting update twice, from supabase query and realtime updates.
    await subscription.unsubscribe();
  }

  // Determine user based on Google or IMAP credentials
  const user = state.googleUser.id ? state.googleUser : state.imapUser;

  // Call refined_persons stored procedure using Supabase client
  const rpcResult = await supabase.rpc("refined_persons", { userid: user.id });

  if (rpcResult.error) {
    console.error(rpcResult.error);
  }

  // Fetch data from Supabase for current user and update store with email addresses
  const data = await fetchData(
    supabase,
    user.id,
    "refinedpersons",
    process.env.SUPABASE_MAX_ROWS
  );
  data.forEach((person) => commit("SET_EMAILS", person));

  // Subscribe to real-time updates for current user
  subscribeToRefined(user.id, commit);
}

export async function startMining({ state, commit }, { data }) {
  const user = state.googleUser.id ? state.googleUser : state.imapUser;

  commit("SET_LOADING", true);
  commit("SET_LOADING_DNS", true);
  commit("SET_SCANNEDEMAILS", 0);
  commit("SET_EXTRACTEDEMAILS", 0);
  commit("SET_STATISTICS", "f");
  commit("SET_SCANNEDBOXES", []);

  if (subscription) await subscription.unsubscribe();
  subscribeToRefined(user.id, commit);

  try {
    const { boxes } = data;

    const response = await this.$axios.post(
      `${this.$api}/imap/mine/${user.id}`,
      { boxes },
      { headers: { "X-imap-login": JSON.stringify(user) } }
    );

    const task = response.data?.data?.task;
    const { userId, miningId } = task;

    sse.initConnection(userId, miningId);
    sse.registerEventHandlers(miningId, this);

    commit("SET_MINING_TASK", task);
    commit("SET_LOADING", false);
    commit("SET_LOADING_DNS", false);
    commit("SET_STATUS", "");
    commit("SET_INFO_MESSAGE", "Mining started");
  } catch (error) {
    sse.closeConnection();
    const message =
      error?.response?.data?.error.message ||
      error?.response?.data?.error ||
      error;
    commit("SET_ERROR", message);
    Promise.reject(message);
  }
}

export async function stopMining({ state, commit }, { data }) {
  try {
    const user = state.googleUser.id ? state.googleUser : state.imapUser;

    const { miningId } = data;

    await this.$axios.delete(`${this.$api}/imap/mine/${user.id}/${miningId}`, {
      headers: { "X-imap-login": JSON.stringify(user) },
    });

    commit("DELETE_MINING_TASK");
    commit("SET_STATUS", "");
    commit("SET_INFO_MESSAGE", "Mining stopped");
  } catch (error) {
    const message =
      error?.response?.data?.error.message ||
      error?.response?.data?.error ||
      error;
    commit("SET_ERROR", message);
    Promise.reject(message);
  }
}

export function signUp({ commit }, { data }) {
  return new Promise((resolve, reject) => {
    commit("SET_LOADING", true);
    // get imapInfo account or create one
    this.$axios
      .post(`${this.$api}/imap/signup`, data)
      .then((response) => {
        commit("SET_LOADING", false);
        commit("SET_INFO_MESSAGE", response.data.message);
        resolve(response);
      })
      .catch((error) => {
        if (error) {
          commit("SET_ERROR", error?.response.data.error);
        }
        reject(error.message);
      });
  });
}
export function signUpGoogle({ commit }, { data }) {
  return new Promise((resolve, reject) => {
    commit("SET_LOADING", true);
    this.$axios
      .post(`${this.$api}/imap/signUpGoogle`, { authCode: data })
      .then((response) => {
        commit("SET_LOADING", false);
        commit("SET_GOOGLE_USER", response.data.googleUser);
        resolve(response);
      })
      .catch((error) => {
        if (error) {
          commit("SET_ERROR", error?.response.data.error);
        }
        reject(error.message);
      });
  });
}
export async function signIn({ state, commit }, { data }) {
  try {
    commit("SET_LOADING", true);
    const response = await this.$axios.post(`${this.$api}/imap/login`, data);
    commit("SET_LOADING", false);

    commit("SET_IMAP", response.data.imap);
    const imapUser = state.imapUser;
    imapUser.password = data.password;
    LocalStorage.set("imapUser", imapUser);

    return response.data;
  } catch (error) {
    commit("SET_ERROR", error?.response.data.error.message);
    throw new Error(error.message);
  }
}

export async function getBoxes({ state, commit }) {
  commit("SET_LOADINGBOX", true);

  const user =
    state.googleUser.access_token === "" ? state.imapUser : state.googleUser;

  commit("SET_USERID", user.id);

  try {
    const { data } = await this.$axios.get(`${this.$api}/imap/1/boxes`, {
      headers: { "X-imap-login": JSON.stringify(user) },
    });

    commit("SET_LOADINGBOX", false);
    commit("SET_BOXES", data.imapFoldersTree);
    commit("SET_INFO_MESSAGE", "Successfully retrieved IMAP boxes.");
  } catch (error) {
    commit(
      "SET_ERROR",
      error?.response?.data?.error
        ? error?.response?.data?.error
        : error.message
    );
    throw error;
  }
}
