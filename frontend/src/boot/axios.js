import axios from "axios";
import { boot } from "quasar/wrappers";

const api = axios.create({
  baseURL: `${process.env.SERVER_ENDPOINT}/api`,
  // withCredentials: true,
});
export default boot(({ app, store }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios;
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file
  store.$axios = axios;
  store.$api = api.defaults.baseURL;

  app.config.globalProperties.$api = api;
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
});

export { axios, api };
