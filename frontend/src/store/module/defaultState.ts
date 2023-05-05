import { LocalStorage } from "quasar";

export function getDefaultState() {
  return {
    miningTask: {},
    loadingStatus: false,
    loadingStatusDns: false,
    loadingStatusbox: false,
    userId: "",
    imapUser: LocalStorage.getItem("imapUser"),
    googleUser: LocalStorage.getItem("googleUser"),
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
