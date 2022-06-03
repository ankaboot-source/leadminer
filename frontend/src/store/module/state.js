export default function () {
  return {
    retrievedEmails: [],
    loadingStatus: false,
    loadingStatusDns: false,
    loadingStatusbox: false,
    imapUser: {
      id: "",
      email: "",
      password: "",
      host: "",
      port: "",
    },
    googleUser: {
      email: "",
      access_token: "",
      id: "",
    },
    boxes: [],
    errorMessage: "",
    infoMessage: "",
    progress: {
      scannedEmails: Number(0),

      status: "",
      scannedBoxes: [],
      invalidAddresses: Number(0),
    },
    cancel: null,
  };
}
