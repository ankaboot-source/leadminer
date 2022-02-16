import { boot } from "quasar/wrappers";

import { io } from "socket.io-client";

const socket = io(process.env.ENDPOINT);


export default boot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$socket = socket;
});

export { socket };
