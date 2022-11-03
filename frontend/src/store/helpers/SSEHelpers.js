let reconnectFrequencySeconds = 1;

export function eventListenersHandler(currentState, source, parent) {
  console.log(source);
  source.addEventListener(
    "minedEmails" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      let data = JSON.parse(message.data);
      //parent.commit("example/SET_SCANNEDEMAILS", data.scanned);
      parent.commit("example/SET_EMAILS", data.data);
      parent.commit("example/SET_STATISTICS", data.statistics);
    }
  );
  source.addEventListener(
    `ScannedEmails${currentState.imapUser.id}${currentState.googleUser.id}`,
    (message) => {
      console.log("hello");
      let data = JSON.parse(message.data);
      parent.commit("example/SET_SCANNEDEMAILS", data.scanned);
      //parent.commit("example/SET_EMAILS", data.data);
      //parent.commit("example/SET_INVALIDADDRESSES", data.totalScanned);
    }
  );
  source.addEventListener(
    "scannedBoxes" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      parent.commit("example/SET_SCANNEDBOXES", message.data);
    }
  );
  source.addEventListener(
    "token" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      let googleUser = localStorage.getItem("googleUser");

      localStorage.remove("googleUser");
      let access_token = JSON.parse(message.data).token;
      localStorage.set("googleUser", {
        access_token: access_token,
        email: googleUser.email,
        id: googleUser.id,
      });

      parent.commit("example/UPDATE_TOKEN", JSON.parse(message.data).token);
    }
  );
  source.addEventListener(
    "token" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      parent.commit("example/UPDATE_TOKEN", JSON.parse(message.data).token);
    }
  );

  window.addEventListener(
    "beforeunload" + currentState.imapUser.id + currentState.googleUser.id,
    () => {
      source.close();
    }
  );
  source.addEventListener(
    "dns" + currentState.imapUser.id + currentState.googleUser.id,
    (message) => {
      parent.commit("example/SET_LOADING_DNS", false);
    }
  );
  return source;
}

export function setupEventSourceHelper(self) {
  let waitFunc = function () {
    return reconnectFrequencySeconds * 10;
  };
  let tryToSetupFunc = function () {
    setupEventSourceHelper();
    reconnectFrequencySeconds *= 2;
    if (reconnectFrequencySeconds >= 64) {
      reconnectFrequencySeconds = 64;
    }
  };

  let reconnectFunc = function () {
    setTimeout(tryToSetupFunc, waitFunc());
  };
  let source = new EventSource(`${self.$api}/stream`, {
    withCredentials: true,
  });
  console.log(source);
  return source;
  
  /* Unreachable code
  
  source.onmessage = function (e) {};
  source.onopen = function (e) {
    reconnectFrequencySeconds = 1;
    return source;
  };
  source.onerror = function (e) {
    source.close();
    reconnectFunc();
  };
  */

}
