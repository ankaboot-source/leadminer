import { MiningSource } from "src/types/providers";

export function getDefaultState() {
  return {
    miningTask: null,
    loadingStatus: false,
    loadingStatusDns: false,
    loadingStatusbox: false,
    miningSources: [] as MiningSource[],
    activeMiningSource: null as MiningSource | null,
    isLoadingSources: false,
    boxes: [],
    selectedBoxes: [],
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
