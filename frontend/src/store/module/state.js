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
      scannedEmails: Number(0),
      totalEmails: Number(0),
      status: "",
      scannedBoxes: [],
      invalidAddresses: Number(0),
    },
    cancel: null,
  };
}
