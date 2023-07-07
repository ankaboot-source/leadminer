import { AxiosError } from "axios";
import { defineStore } from "pinia";
import { api } from "src/boot/axios";
import { sse } from "src/helpers/sse";
import { supabase } from "src/helpers/supabase";
import { MiningSource } from "src/types/providers";
import { ref } from "vue";

export const useCounterStore = defineStore("leadminer", () => {
  const miningTask = ref(null);
  const miningSources = ref<MiningSource[]>([]);
  const activeMiningSource = ref<MiningSource | null>(null);
  const boxes = ref<string[]>([]);
  const selectedBoxes = ref<string[]>([]);

  const errorMessage = ref("");
  const infoMessage = ref("");

  const isLoadingSources = ref(false);
  const loadingStatus = ref(false);
  const loadingStatusDns = ref(false);
  const loadingStatusbox = ref(false);

  const extractedEmails = ref(0);
  const scannedEmails = ref(0);
  const totalFetchedEmails = ref(0);
  const status = ref("");
  const scannedBoxes = ref<string[]>([]);
  const statistics = ref({});

  const errors = ref({});

  async function getMiningSources() {
    try {
      isLoadingSources.value = true;
      const { data } = await api.get<{
        message: string;
        sources: MiningSource[];
      }>("/imap/mine/sources");
      miningSources.value = data.sources;
      if (data.sources.length > 0) {
        [activeMiningSource.value] = data.sources;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      isLoadingSources.value = false;
    }
  }

  async function getBoxes(miningSource: MiningSource) {
    loadingStatusbox.value = true;

    try {
      const response = await api.post("/imap/boxes", miningSource);

      const folders = response.data?.data?.folders;

      if (folders) {
        boxes.value = [...folders];
        infoMessage.value = "Successfully retrieved IMAP boxes.";
      }
    } catch (err) {
      if (err !== null && err instanceof AxiosError) {
        let message = null;
        const error = err.response?.data?.error || err;

        if (error.message?.toLowerCase() === "network error") {
          message =
            "Unable to access server. Please retry again or contact your service provider.";
        } else {
          message = error.message;
        }

        errorMessage.value = message;
      }
      throw err;
    } finally {
      loadingStatusbox.value = false;
    }
  }

  async function startMining() {
    loadingStatus.value = true;
    loadingStatusDns.value = true;
    scannedEmails.value = 0;
    extractedEmails.value = 0;
    statistics.value = "f";
    scannedBoxes.value = [];

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session?.access_token) {
        return;
      }

      const response = await api.post(
        `/imap/mine/${sessionData.session.user.id}`,
        {
          boxes: selectedBoxes.value,
          miningSource: activeMiningSource.value,
        }
      );

      const task = response.data?.data;
      const { miningId } = task;

      sse.initConnection(miningId, sessionData.session.access_token, {
        onExtractedUpdate: (count) => {
          extractedEmails.value = count;
        },
        onFetchedUpdate: (count) => {
          scannedEmails.value = count;
        },
        onClose: () => {
          miningTask.value = null;
        },
        onFetchingDone: (totalFetched) => {
          totalFetchedEmails.value = totalFetched;
        },
      });

      miningTask.value = task;
      loadingStatus.value = false;
      loadingStatusDns.value = false;
      status.value = "";
      infoMessage.value = "Mining has started";
    } catch (err) {
      sse.closeConnection();
      if (err !== null && err instanceof AxiosError) {
        let message = null;
        const error = err.response?.data?.error || err;

        if (error.message?.toLowerCase() === "network error") {
          message =
            "Unable to access server. Please retry again or contact your service provider.";
        } else {
          message = error.message;
        }

        error.value = message;
      }
      throw err;
    }
  }

  return {
    getMiningSources,
    getBoxes,
    startMining,
    mininingTask: miningTask,
    miningSources,
    activeMiningSource,
    boxes,
    selectedBoxes,
    errorMessage,
    infoMessage,
    isLoadingSources,
    loadingStatus,
    loadingStatusDns,
    loadingStatusbox,
    extractedEmails,
    scannedEmails,
    status,
    scannedBoxes,
    statistics,
    errors,
  };
});
