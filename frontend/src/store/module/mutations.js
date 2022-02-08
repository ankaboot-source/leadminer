export function SET_EMAILS(state, emails) {
  state.retrievedEmails = emails;
}
export function SET_LOADING(state, newLoadingStatus) {
  state.loadingStatus = newLoadingStatus;
}
export function SET_IMAP(state, newImap) {
  state.imap.email = newImap.email;
  state.imap.host = newImap.host;
  state.imap.port = newImap.port;
}
export function SET_BOXES(state, newBoxes) {
  state.boxes = newBoxes;
}
export function SET_ERROR(state, newError) {
  state.error = newError;
}
