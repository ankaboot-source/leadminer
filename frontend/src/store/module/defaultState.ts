import { LocalStorage } from "quasar";

export function getDefaultState() {
  return {
    miningTask: {},
    loadingStatus: false,
    loadingStatusDns: false,
    loadingStatusbox: false,
    userId: "",
    user: LocalStorage.has("user") ? LocalStorage.getItem("user") : null,
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
