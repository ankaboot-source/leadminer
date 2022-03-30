export function SET_EMAILS(state, emails) {
  state.retrievedEmails = emails;
}
export function SET_LOADING(state, newLoadingStatus) {
  state.loadingStatus = newLoadingStatus;
}
export function SET_LOADINGBOX(state, newLoadingStatusbox) {
  state.loadingStatusbox = newLoadingStatusbox;
}
export function SET_IMAP(state, newImap) {
  console.log(newImap);
  state.imap.id = newImap.id;
  state.imap.email = newImap.email;
  state.imap.host = newImap.host;
  state.imap.port = newImap.port;
}
export function SET_PASSWORD(state, newPassword) {
  console.log(newPassword);
  state.imap.password = newPassword;
}
export function SET_BOXES(state, newBoxes) {
  state.boxes = [...newBoxes];
}
export function SET_ERROR(state, newError) {
  state.errorMessage = newError;
}
export function SET_SESSIONID(state, newSocket) {
  state.socketId = newSocket;
}
export function SET_PERCENTAGE(state, newPercentage) {
  state.progress.percentage = newPercentage;
}
export function SET_CURRENT(state, newBoxName) {
  state.progress.currentBox = newBoxName;
}
export function SET_STATUS(state, newStatus) {
  state.progress.status = newStatus;
}
