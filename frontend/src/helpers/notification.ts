import { QVueGlobals } from "quasar";

export function showNotification(
  quasarInstance: QVueGlobals,
  msg: string,
  color: string,
  icon: string
) {
  quasarInstance.notify({
    message: msg,
    color,
    icon,
    actions: [
      {
        label: "ok",
        color: "white",
      },
    ],
  });
}
