import { QVueGlobals } from "quasar";

export function showNotification(
  quasarInstance: QVueGlobals,
  msg: string,
  type: "positive" | "negative" | "warning" | "info" | "ongoing",
  icon?: string
) {
  quasarInstance.notify({
    message: msg,
    icon,
    type,
  });
}
