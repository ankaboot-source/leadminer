export function getRetrievedEmails(state) {
  return Object.values(state.retrievedEmails);
}
export function getBoxes(state) {
  return state.boxes;
}
export function getStates(state) {
  return state;
}

export function getUserEmail(state) {
  return state.imapUser.email ? state.imapUser.email : state.googleUser.email;
}