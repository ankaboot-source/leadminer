/* eslint-disable @typescript-eslint/no-explicit-any */
import { LocalStorage } from "quasar";

import { RealtimeChannel, createClient } from "@supabase/supabase-js";
import { api } from "src/boot/axios";
import { sse } from "src/helpers/sse";
import { fetchData } from "src/helpers/supabase.js";

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SECRET_PROJECT_TOKEN
);

let subscription: RealtimeChannel;

function subscribeToRefined(userId: string, commit: any) {
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
        commit("ADD_EMAIL", payload.new);
      }
    )
    .subscribe();
}
export async function syncRefinedPersons({ state, commit, getters }: any) {
  if (!getters.isLoggedIn) {
    return;
  }

  if (subscription) {
    // Unsubscribe from real-time updates if currently subscribed
    // to avoid getting update twice, from supabase query and realtime updates.
    await subscription.unsubscribe();
  }

  const user = state.googleUser.id ? state.googleUser : state.imapUser;
  const { error } = await supabase.rpc("refined_persons", { userid: user.id });

  if (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  // Fetch data from Supabase for current user and update store with email addresses
  const contacts = await fetchData(
    supabase,
    user.id,
    "refinedpersons",
    process.env.SUPABASE_MAX_ROWS
  );

  commit(
    "SET_EMAILS",
    new Map(contacts.map((contact) => [contact.email, contact]))
  );
}

export async function startMining(
  this: any,
  { state, commit }: any,
  { data }: any
) {
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

    const response = await api.post(
      `/imap/mine/${user.id}`,
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
  } catch (error: any) {
    sse.closeConnection();
    const message =
      error?.response?.data?.error.message ||
      error?.response?.data?.error ||
      error;
    commit("SET_ERROR", message);
    Promise.reject(message);
  }
}

export async function stopMining({ state, commit }: any, { data }: any) {
  try {
    const user = state.googleUser.id ? state.googleUser : state.imapUser;

    const { miningId } = data;

    await api.delete(`/imap/mine/${user.id}/${miningId}`, {
      headers: { "X-imap-login": JSON.stringify(user) },
    });

    commit("DELETE_MINING_TASK");
    commit("SET_STATUS", "");
    commit("SET_INFO_MESSAGE", "Mining stopped");
  } catch (error: any) {
    const message =
      error?.response?.data?.error.message ||
      error?.response?.data?.error ||
      error;
    commit("SET_ERROR", message);
    Promise.reject(message);
  }
}

export function signUp({ commit }: any, { data }: any) {
  return new Promise((resolve, reject) => {
    commit("SET_LOADING", true);
    // get imapInfo account or create one
    api
      .post("/imap/signup", data)
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
export function signUpGoogle({ commit }: any, { data }: any) {
  return new Promise((resolve, reject) => {
    commit("SET_LOADING", true);
    api
      .post("/imap/signUpGoogle", { authCode: data })
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
export async function signIn({ state, commit }: any, { data }: any) {
  try {
    const response = await api.post("/imap/login", data);
    const imapUser = { ...state.imapUser, password: data.password };

    commit("SET_IMAP", response.data.imap);
    LocalStorage.set("imapUser", imapUser);

    return response.data;
  } catch (error: any) {
    const fieldErrors = error?.response?.data?.error?.errors;
    const err = new Error(
      error?.response?.data?.error?.message ||
        error?.response?.data?.error ||
        error?.message
    );

    if (fieldErrors) {
      commit("SET_ERRORS", fieldErrors);
      commit("SET_ERROR", null);
    } else {
      if (err.message.toLowerCase() === "network error") {
        err.message =
          "Oops! Something went wrong. Please check your internet connection and try again later.";
      }
      commit("SET_ERROR", err.message);
      commit("SET_ERRORS", {});
    }

    throw new Error(error);
  }
}

export async function getBoxes({ state, commit }: any) {
  commit("SET_LOADINGBOX", true);

  const user =
    state.googleUser.access_token === "" ? state.imapUser : state.googleUser;

  commit("SET_USERID", user.id);

  try {
    const { data } = await api.get("/imap/1/boxes", {
      headers: { "X-imap-login": JSON.stringify(user) },
    });

    commit("SET_LOADINGBOX", false);
    commit("SET_BOXES", data.imapFoldersTree);
    commit("SET_INFO_MESSAGE", "Successfully retrieved IMAP boxes.");
  } catch (error: any) {
    commit(
      "SET_ERROR",
      error?.response?.data?.error
        ? error?.response?.data?.error
        : error.message
    );
    throw error;
  }
}
