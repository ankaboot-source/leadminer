export default function () {
  return {
    retrievedEmails: [],
    loadingStatus: false,
    loadingStatusDns: false,
    loadingStatusbox: false,
    imap: {
      id: "",
      email: "",
      password: "",
      host: "",
      port: "",
    },
    boxes: [],
    errorMessage: "",
    progress: {
      percentage: 0,
      currentBox: "",
      status: "",
    },
  };
}
