import { AxiosError } from "axios";
import { defineStore } from "pinia";
import { api } from "src/boot/axios";
import { BoxNode, getDefaultSelectedFolders } from "src/helpers/boxes";
import { sse } from "src/helpers/sse";
import { supabase } from "src/helpers/supabase";
import { MiningSource, MiningTask } from "src/types/mining";
import { ref } from "vue";

export const useLeadminerStore = defineStore("leadminer", () => {
  const miningTask = ref<MiningTask | undefined>();
  const miningSources = ref<MiningSource[]>([]);
  const activeMiningSource = ref<MiningSource | undefined>();
  const boxes = ref<BoxNode[]>([]);
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

  function $reset() {
    miningTask.value = undefined;
    miningSources.value = [];
    activeMiningSource.value = undefined;
    boxes.value = [];
    selectedBoxes.value = [];

    errorMessage.value = "";
    infoMessage.value = "";

    isLoadingSources.value = false;
    loadingStatus.value = false;
    loadingStatusDns.value = false;
    loadingStatusbox.value = false;

    extractedEmails.value = 0;
    scannedEmails.value = 0;
    totalFetchedEmails.value = 0;

    status.value = "";
    scannedBoxes.value = [];
    statistics.value = {};
    errors.value = {};
  }

  async function getMiningSources() {
    try {
      isLoadingSources.value = true;
      const { data } = await api.get<{
        message: string;
        sources: MiningSource[];
      }>("/imap/mine/sources");
      miningSources.value = data.sources;
      if (data.sources.length > 0) {
        activeMiningSource.value = data.sources.at(-1); // Use the newest mining source as a default
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      isLoadingSources.value = false;
    }
  }

  async function getBoxes() {
    if (!activeMiningSource.value) {
      return;
    }
    loadingStatusbox.value = true;
    boxes.value = [];
    selectedBoxes.value = [];

    try {
      const response = await api.post("/imap/boxes", {
        ...activeMiningSource.value,
      });

      const folders = response.data?.data?.folders;

      if (folders) {
        boxes.value = [...folders];
        selectedBoxes.value = getDefaultSelectedFolders(folders);
        infoMessage.value = "Successfully retrieved IMAP boxes.";
      }
      miningSources.value = miningSources.value.reduce<MiningSource[]>(
        (result, current) => {
          if (current.email === activeMiningSource.value?.email) {
            current.isValid = true;
          }
          result.push(current);

          return result;
        },
        []
      );
    } catch (err) {
      if (err instanceof AxiosError) {
        const error = err.response?.data?.error || err;

        if (error.message?.toLowerCase() === "network error") {
          errorMessage.value =
            "Unable to access server. Please retry again or contact your service provider.";
        } else {
          errorMessage.value =
            "Failed to connect to mining source! This probably means that you revoked access or changed your credentials. Please add this source again if you want to use it";
        }
      }
      miningSources.value = miningSources.value.reduce<MiningSource[]>(
        (result, current) => {
          if (current.email === activeMiningSource.value?.email) {
            current.isValid = false;
          }
          result.push(current);

          return result;
        },
        []
      );
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

      const response = await api.post<{ data: MiningTask }>(
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
          miningTask.value = undefined;
          sse.closeConnection();
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

  async function stopMining() {
    try {
      const { data: session } = await supabase.auth.getUser();

      if (!session.user || !miningTask.value) {
        return;
      }

      const { miningId } = miningTask.value;

      await api.delete(`/imap/mine/${session.user.id}/${miningId}`);

      miningTask.value = undefined;
      status.value = "";
      infoMessage.value = "Mining has stopped";
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
    }
  }

  return {
    getMiningSources,
    getBoxes,
    startMining,
    stopMining,
    $reset,
    miningTask,
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
    totalFetchedEmails,
    extractedEmails,
    scannedEmails,
    status,
    scannedBoxes,
    statistics,
    errors,
  };
});
