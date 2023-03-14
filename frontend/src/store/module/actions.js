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

export async function fetchRefinedPersons({ state, commit }) {
  const user = state.googleUser.id ? state.googleUser : state.imapUser;
  const rpcResult = await supabase.rpc("refined_persons", { userid: user.id });

  if (rpcResult.error) {
    console.error(rpcResult.error);
  }
  const data = await fetchData(
    supabase,
    user.id,
    "refinedpersons",
    process.env.SUPABASE_MAX_ROWS
  );
  data.forEach((person) => commit("SET_EMAILS", person));
}

export async function startMining({ state, commit }, { data }) {
  return new Promise(async (resolve, reject) => {
    const user = state.googleUser.id ? state.googleUser : state.imapUser;

    commit("SET_LOADING", true);
    commit("SET_LOADING_DNS", true);
    commit("SET_SCANNEDEMAILS", 0);
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

      const { task } = response.data?.data;
      const { userId, miningId } = task;

      sse.initConnection(userId, miningId);
      sse.registerEventHandlers(miningId, this);

      commit("SET_MINING_TASK", task);
      commit("SET_LOADING", false);
      commit("SET_LOADING_DNS", false);
      commit("SET_STATUS", "");
      commit("SET_INFO_MESSAGE", "Successfully started mining");
      resolve();
    } catch (error) {
      sse.closeConnection();
      const message =
        error?.response?.data?.error.message ||
        error?.response?.data?.error ||
        error;
      commit("SET_ERROR", message);
      reject(message);
    }
  });
}

export async function stopMining({ state, commit }, { data }) {
  return new Promise(async (resolve, reject) => {
    try {
      const user = state.googleUser.id ? state.googleUser : state.imapUser;

      const { miningId } = data;

      await this.$axios.delete(
        `${this.$api}/imap/mine/${user.id}/${miningId}`,
        { headers: { "X-imap-login": JSON.stringify(user) } }
      );

      commit("SET_MINING_TASK", {});
      commit("SET_STATUS", "");
      commit("SET_INFO_MESSAGE", "Successfully stopped mining");
      resolve();
    } catch (error) {
      const message =
        error?.response?.data?.error.message ||
        error?.response?.data?.error ||
        error;
      commit("SET_ERROR", message);
      reject(message);
    }
  });
}

export async function signUp(_, { data }) {
  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    // get imapInfo account or create one
    this.$axios
      .post(`${this.$api}/imap/signup`, data)
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_INFO_MESSAGE", response.data.message);
        resolve(response);
      })
      .catch((error) => {
        if (error) {
          this.commit("example/SET_ERROR", error?.response.data.error);
        }
        reject(error.message);
      });
  });
}
export async function signUpGoogle(_, { data }) {
  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    this.$axios
      .post(`${this.$api}/imap/signUpGoogle`, { authCode: data })
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_GOOGLE_USER", response.data.googleUser);
        resolve(response);
      })
      .catch((error) => {
        if (error) {
          this.commit("example/SET_ERROR", error?.response.data.error);
        }
        reject(error.message);
      });
  });
}
export async function signIn(_, { data }) {
  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    // get imapInfo account or create one
    this.$axios
      .post(`${this.$api}/imap/login`, data)
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_IMAP", response.data.imap);
        const imapUser = this.state.example.imapUser;
        imapUser.password = data.password;
        LocalStorage.set("imapUser", imapUser);
        resolve(response.data);
      })
      .catch((error) => {
        if (error) {
          this.commit("example/SET_ERROR", error?.response.data.message);
        }
        reject(error.message);
      });
  });
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
