import { markRaw } from "vue";
export default function () {
  return {
    retrievedEmails: [],
    loadingStatus: false,
    loadingStatusbox: false,
    imap: {
      id: "",
      email: "",
      password: "",
      host: "",
      port: "",
    },
    boxes: [],
    errorMessage: "",
    socketId: "",
  };
}
