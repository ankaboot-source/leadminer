import { boot } from "quasar/wrappers";
import gAuthPlugin from "vue3-google-oauth2";
let gauthClientId =
  "865693030337-d1lmavgk1fp3nfk8dfo38j75nobn2vvl.apps.googleusercontent.com";

export default boot(({ app, store }) => {
  app.use(gAuthPlugin, {
    clientId: gauthClientId,
    scope: "https://mail.google.com/",
    prompt: "consent",
    fetch_basic_profile: false,
  });
});
