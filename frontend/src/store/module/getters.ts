/* eslint-disable @typescript-eslint/no-explicit-any */
export function getBoxes(state: any) {
  return state.boxes;
}
export function getStates(state: any) {
  return state;
}

export function getCurrentUser(state: any) {
  return { ...state.user, ...state.imapCredentials };
}

export function isLoggedIn(state: any) {
  return !!state.user;
}

export function getFormErrors(state: any) {
  return state.errors;
}
