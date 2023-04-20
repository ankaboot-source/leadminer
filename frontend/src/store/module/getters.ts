/* eslint-disable @typescript-eslint/no-explicit-any */
export function getRetrievedEmails(state: any) {
  return Array.from(state.retrievedEmails.values());
}
export function getBoxes(state: any) {
  return state.boxes;
}
export function getStates(state: any) {
  return state;
}

export function getUserEmail(state: any) {
  return state.imapUser.email ? state.imapUser.email : state.googleUser.email;
}

export function getFormErrors(state: any) {
  return state.errors;
}
