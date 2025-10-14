export interface Notification {
  user_id: string;
  row_id: string;
  type: 'enrich' | 'clean' | 'extract' | 'signature';
  details: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([]);
  const supabase = useSupabaseClient();
  const $user = useSupabaseUser();

  let subscription: ReturnType<typeof supabase.channel> | null = null;

  function subscribe(callback?: (notification: Notification) => void) {
    if (!$user.value?.sub) return;

    if (subscription) {
      supabase.removeChannel(subscription);
      subscription = null;
    }

    subscription = supabase
      .channel('private:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'private',
          table: 'notifications',
          filter: `user_id=eq.${$user.value.sub}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          notifications.value.unshift(newNotification);

          if (callback) callback(newNotification);
        },
      )
      .subscribe();
  }

  function $reset() {
    notifications.value = [];
    if (subscription) {
      supabase.removeChannel(subscription);
      subscription = null;
    }
  }

  return {
    subscription,
    notifications,
    subscribe,
    $reset,
  };
});
