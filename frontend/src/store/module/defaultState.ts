import { LocalStorage } from "quasar";

export function getDefaultState() {
  return {
    miningTask: {},
    loadingStatus: false,
    loadingStatusDns: false,
    loadingStatusbox: false,
    userId: "",
    user: JSON.parse(LocalStorage.getItem("user") as string),
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
