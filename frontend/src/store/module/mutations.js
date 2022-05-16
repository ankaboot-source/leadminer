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
  state.imap.id = newImap.id;
  state.imap.email = newImap.email;
  state.imap.host = newImap.host;
  state.imap.port = newImap.port;
}
export function SET_PASSWORD(state, newPassword) {
  state.imap.password = newPassword;
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
  state.progress.scannedEmails = newValue;
}
export function SET_CANCEL(state, newValue) {
  state.cancel = newValue;
}
export function SET_TOTAL(state, newValue) {
  state.progress.totalEmails = newValue;
}
export function SET_STATUS(state, newStatus) {
  state.progress.status = newStatus;
}
export function SET_TOKEN(state, newToken) {
  state.token = newToken;
}
