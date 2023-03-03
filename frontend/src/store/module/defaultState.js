export function getDefaultState() {
  return {
    retrievedEmails: {},
    loadingStatus: false,
    loadingStatusDns: false,
    loadingStatusbox: false,
    userId: "",
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
      extractedEmails: 0,
      scannedEmails: 0,
      status: "",
      scannedBoxes: [],
      statistics: {},
    },
  };
}
