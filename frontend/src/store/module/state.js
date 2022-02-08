import { markRaw } from "vue";
export default function () {
  return {
    retrievedEmails: [],
    loadingStatus: false,
    imap: {
      email: "",
      host: "",
      port: "",
    },
    boxes: [],
    error: "",
  };
}
