import { markRaw } from "vue";
export default function () {
  return {
    retrievedEmails: [],
    loadingStatus: false,
    imap: {
      id: "",
      email: "",
      password: "",
      host: "",
      port: "",
    },
    boxes: [],
    error: "",
  };
}
