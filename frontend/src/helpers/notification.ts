import { useQuasar } from "quasar";

const $q = useQuasar();

export function showNotification(msg: string, color: string, icon: string) {
    $q.notify({
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