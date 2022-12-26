export default function () {
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
      scannedEmails: Number(0),
      status: "",
      scannedBoxes: [],
      statistics: {},
    },
    cancel: null,
    initialState: {
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
        scannedBoxes: Array(0),
        statistics: {},
      },
      cancel: null,
    },
  };
}
