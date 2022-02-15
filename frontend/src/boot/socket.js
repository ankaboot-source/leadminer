import { boot } from "quasar/wrappers";

import { io } from "socket.io-client";

const socket = io("http://46.101.205.87:8081");

export default boot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$socket = socket;
});

export { socket };
