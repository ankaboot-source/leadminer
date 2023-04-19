export function getRetrievedEmails(state) {
  return Array.from(state.retrievedEmails.values());
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

export function getFormErrors(state) {
  return state.errors;
}
