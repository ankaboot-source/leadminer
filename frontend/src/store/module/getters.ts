/* eslint-disable @typescript-eslint/no-explicit-any */
export function getBoxes(state: any) {
  return state.boxes;
}
export function getStates(state: any) {
  return state;
}

export function getCurrentUser(state: any) {
  return state.imapUser ? state.imapUser : state.googleUser;
}

export function isLoggedIn(state: any) {
  return !!getCurrentUser(state);
}

export function getFormErrors(state: any) {
  return state.errors;
}
