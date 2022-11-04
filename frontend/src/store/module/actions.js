import { createClient } from "@supabase/supabase-js";
import { LocalStorage } from "quasar";
import {
  setupEventSourceHelper,
  eventListenersHandler,
} from "../helpers/SSEHelpers";
const supabase = createClient(
  process.env.SUPABASE_ID,
  process.env.SUPABASE_TOKEN
);
//register source globally so we can access from anywere
let source;

export function setupEventSource() {
  source = setupEventSourceHelper.bind(this);
}

//////

function initStore(parent, currentState) {
  supabase
    .channel("leadminerProject")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "refinedpersons",
        filter: `userid=eq.${
          currentState.imapUser.id + currentState.googleUser.id
        }`,
      },
      (payload) => {
        setTimeout(() => {
          parent.commit("example/SET_EMAILS", payload.new);
        }, 50);
      }
    )
    .subscribe();
  parent.commit("example/SET_LOADING", true);
  parent.commit("example/SET_LOADING_DNS", true);
  parent.commit("example/SET_SCANNEDEMAILS", "f");
  parent.commit("example/SET_STATISTICS", "f");
  parent.commit("example/SET_SCANNEDBOXES", []);
}
function updateStoreWhenFinish(response, parent) {
  parent.commit("example/SET_LOADING", false);
  parent.commit("example/SET_LOADING_DNS", false);
  parent.commit("example/SET_STATUS", "");
  parent.commit("example/SET_EMAILS", response.data.data);
  parent.commit("example/SET_INFO_MESSAGE", response.data.message);
}
export function getEmails({ getters }, { data }) {
  const currentState = getters.getStates;
  const CancelToken = this.$axios.CancelToken;
  const sources = CancelToken.source();
  source = setupEventSourceHelper(this);
  source = eventListenersHandler(currentState, source, this);
  const ProxyChange = {
    // eslint-disable-line
    set: function (target, key, value) {
      if (value == true) {
        sources.cancel();
      }
      return Reflect.set(...arguments);
    },
  };
  return new Promise((resolve, reject) => {
    const timer = new Proxy({ cancelRequest: false }, ProxyChange);
    initStore(this, currentState);
    this.commit("example/SET_CANCEL", timer);
    if (currentState.googleUser.access_token) {
      this.$axios
        .get(this.$api + `/imap/1/collectEmails`, {
          headers: { "X-imap-login": JSON.stringify(currentState.googleUser) },
          cancelToken: sources.token,
          params: {
            fields: data.fields.split(","),
            boxes: data.boxes,
            folders: data.folders,
          },
        })
        .then((response) => {
          source.close();

          updateStoreWhenFinish(response, this);
          resolve(response);
          source = null;
        })
        .catch((error) => {
          this.commit(
            "example/SET_ERROR",
            error?.response?.data?.error
              ? error?.response?.data?.error
              : error.message
          );
          source = null;
          reject(error.message);
        });
    } else {
      this.$axios
        .get(
          this.$api +
            `/imap/${JSON.parse(
              JSON.stringify(currentState.imapUser.id)
            )}/collectEmails`,
          {
            headers: { "X-imap-login": JSON.stringify(currentState.imapUser) },

            cancelToken: sources.token,
            params: {
              fields: data.fields.split(","),
              boxes: data.boxes,
              folders: data.folders,
            },
          }
        )
        .then((response) => {
          updateStoreWhenFinish(response, this);
          source.close();
          source = null;
          resolve(response);
        })
        .catch((error) => {
          this.commit(
            "example/SET_ERROR",
            error?.response?.data?.error
              ? error?.response?.data?.error
              : error.message
          );
          source = null;
          reject(error.message);
        });
    }
  });
}

export async function signUp(_, { data }) {
  return new Promise((resolve, reject) => {
    this.commit("example/SET_LOADING", true);
    // get imapInfo account or create one
    this.$axios
      .post(this.$api + "/imap/signup", data)
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
      .post(this.$api + "/imap/signUpGoogle", { authCode: data })
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
      .post(this.$api + "/imap/login", data)
      .then((response) => {
        this.commit("example/SET_LOADING", false);
        this.commit("example/SET_IMAP", response.data.imap);
        let imapUser = this.state.example.imapUser;
        imapUser["password"] = data.password;
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
export async function getBoxes({ getters }) {
  const currentState = getters.getStates;

  this.commit("example/SET_LOADINGBOX", true);
  return new Promise((resolve, reject) => {
    if (currentState.googleUser.access_token == "") {
      this.$axios
        .get(
          this.$api +
            `/imap/${JSON.parse(
              JSON.stringify(currentState.imapUser.id)
            )}/boxes`,
          {
            headers: { "X-imap-login": JSON.stringify(currentState.imapUser) },
          }
        )
        .then((response) => {
          this.commit("example/SET_LOADINGBOX", false);
          this.commit("example/SET_BOXES", response.data.imapFoldersTree);
          this.commit("example/SET_INFO_MESSAGE", response.data.message);
          resolve();
        })
        .catch((error) => {
          this.commit(
            "example/SET_ERROR",
            error?.response?.data?.error
              ? error?.response?.data?.error
              : error.message
          );

          reject(error.message);
        });
    } else {
      this.$axios
        .get(this.$api + `/imap/${currentState.googleUser.id}/boxes`, {
          headers: { "X-imap-login": JSON.stringify(currentState.googleUser) },
        })
        .then((response) => {
          this.commit("example/SET_LOADINGBOX", false);
          this.commit("example/SET_BOXES", response.data.imapFoldersTree);
          this.commit("example/SET_INFO_MESSAGE", response.data.message);
        })
        .catch((error) => {
          this.commit(
            "example/SET_ERROR",
            error?.response?.data?.error
              ? error?.response?.data?.error
              : error.message
          );

          reject(error.message);
          if (error?.response?.status == 500) {
            LocalStorage.remove("googleUser");
            this.$router.push({ path: "/" });
          }
        });
    }
  });
}
