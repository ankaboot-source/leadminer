export function SET_EMAILS(state, emails) {
  state.retrievedEmails = emails;
}

export function SET_LOADING(state, newLoadingStatus) {
  state.loadingStatus = newLoadingStatus;
}
