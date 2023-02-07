import { LocalStorage } from "quasar";

import { createClient } from "@supabase/supabase-js";
import { sse } from "src/helpers/sse";

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

/**
 * Fetches data from a Supabase table.
 * @param {String} tableName - The name of the table to fetch data from.
 * @param {Number} [pageSize=1000] - The number of rows to retrieve per request.
 * @returns {Array | void } - An array of data from the specified table.
 */
async function fetchData(tableName, pageSize = 1000) {
  const result = [];
  let offset = 0;
  let response = { data: [1] };

  while (response.data.length > 0) {
    response = await supabase.from(tableName)
      .select("*")
      .range(offset, offset + pageSize - 1);

    if (response.error) {
      console.error(response.error);
      return [];
    }

    result.push(...response.data);
    offset += pageSize;
  }

  return result;
}

export async function fetchRefinedPersons({ state }) {
  const user = state.googleUser.id ? state.googleUser : state.imapUser;
  const rpcResult = await supabase.rpc("refined_persons", { userid: user.id });

  if (rpcResult.error) {
    console.error(rpcResult.error);
    return [];
  }
  const data = fetchData("refinedpersons");
  return data
}

export async function getEmails({ state, commit }, { data }) {
  const user = state.googleUser.id ? state.googleUser : state.imapUser;

  commit("SET_LOADING", true);
  commit("SET_LOADING_DNS", true);
  commit("SET_SCANNEDEMAILS", 0);
  commit("SET_STATISTICS", "f");
  commit("SET_SCANNEDBOXES", []);

  if (subscription) await subscription.unsubscribe();
  subscribeToRefined(user.id, commit);

  sse.init();
  sse.registerEventHandlers(user.id, this);

  try {
    const { boxes, abortController } = data;

    abortController.signal.addEventListener("abort", () => {
      commit("SET_LOADING", false);
      commit("SET_LOADING_DNS", false);
      commit("SET_STATUS", "");
      commit("SET_INFO_MESSAGE", "Emails fetching stopped.");
    });

    await this.$axios.get(`${this.$api}/imap/1/collectEmails`, {
      signal: abortController.signal,
      headers: { "X-imap-login": JSON.stringify(user) },
      params: {
        boxes,
      },
    });

    commit("SET_LOADING", false);
    commit("SET_LOADING_DNS", false);
    commit("SET_STATUS", "");
    commit("SET_INFO_MESSAGE", "Successfully fetched emails");
  } catch (error) {
    commit(
      "SET_ERROR",
      error?.response?.data?.error
        ? error?.response?.data?.error
        : error.message
    );
    sse.closeConnection();
  }
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
          this.commit("example/SET_ERROR", error?.response.data.error);
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
