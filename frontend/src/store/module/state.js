export default function () {
  return {
    retrievedEmails: [],
    loadingStatus: false,
    loadingStatusDns: false,
    loadingStatusbox: false,
    token: "",
    imap: {
      id: "",
      email: "",
      password: "",
      host: "",
      port: "",
    },
    boxes: [],
    errorMessage: "",
    infoMessage: "",
    progress: {
      percentage: 0,
      currentBox: "",
      status: "",
    },
  };
}
