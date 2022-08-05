export function SET_EMAILS(state, emails) {
  state.retrievedEmails = emails;
}
export function SET_LOADING(state, newLoadingStatus) {
  state.loadingStatus = newLoadingStatus;
}
export function SET_LOADING_DNS(state, newLoadingStatusDns) {
  state.loadingStatusDns = newLoadingStatusDns;
}
export function SET_LOADINGBOX(state, newLoadingStatusbox) {
  state.loadingStatusbox = newLoadingStatusbox;
}
export function SET_IMAP(state, newImap) {
  state.imapUser.id = newImap.id;
  state.imapUser.email = newImap.email;
  state.imapUser.password = newImap.password;
  state.imapUser.host = newImap.host;
  state.imapUser.port = newImap.port;
}
export function SET_PASSWORD(state, newPassword) {
  state.imapUser.password = newPassword;
}
export function SET_BOXES(state, newBoxes) {
  state.boxes = [...newBoxes];
}
export function SET_ERROR(state, newError) {
  state.errorMessage = newError;
}
export function SET_INFO_MESSAGE(state, newMessage) {
  state.infoMessage = newMessage;
}
export function SET_SESSIONID(state, newSocket) {
  state.socketId = newSocket;
}
export function SET_SCANNEDEMAILS(state, newValue) {
  if (newValue == "f") {
    state.progress.scannedEmails = 0;
  } else {
    state.progress.scannedEmails += parseInt(newValue);
  }
}
export function SET_INVALIDADDRESSES(state, newValue) {
  if (newValue == "f") {
    state.progress.invalidAddresses = 0;
  } else {
    state.progress.invalidAddresses = parseInt(newValue);
  }
}
export function SET_SCANNEDBOXES(state, newValue) {
  if (newValue.length == 0) {
    state.progress.scannedBoxes = newValue;
  } else {
    let boxesArray = [
      newValue
        .replace('\\"', '"')
        .replaceAll('"', "")
        .substring(newValue.indexOf("/"), newValue.length),
    ];

    boxesArray.push(...state.progress.scannedBoxes);
    state.progress.scannedBoxes = [...new Set(boxesArray)];
  }
}
export function SET_CANCEL(state, newValue) {
  state.cancel = newValue;
}

export function SET_STATUS(state, newStatus) {
  state.progress.status = newStatus;
}
export function SET_UPDATE_TOKEN(state, newToken) {
  if (state.googleUser.access_token.access_token != newToken.access_token) {
    state.googleUser.access_token = newToken;
  }
}

export function SET_GOOGLE_USER(state, user) {
  state.googleUser.email = user.email;
  state.googleUser.id = user.id;
  state.googleUser.access_token = user.access_token;
}
