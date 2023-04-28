export function getDefaultState() {
  return {
    miningTask: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    retrievedEmails: new Map<string, any>(),
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
    oauthUser: {
      email: "",
      accessToken: "",
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
    errors: {},
  };
}
