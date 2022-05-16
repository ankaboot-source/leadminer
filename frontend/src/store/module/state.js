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
      scannedEmails: 0,
      totalEmails: 0,
      status: "",
    },
    cancel: null,
  };
}
