export function convertSeconds(timeInSeconds: number) {
  const { t } = useNuxtApp().$i18n;
  if (timeInSeconds >= 3600) {
    return [
      t('time.hour', Math.floor(timeInSeconds / 3600)),
      t('time.minute', Math.round((timeInSeconds % 3600) / 60)),
      t('time.second', Math.round((timeInSeconds % 3600) % 60)),
    ].join(' ');
  }
  if (timeInSeconds >= 60) {
    return [
      t('time.minute', Math.round((timeInSeconds % 3600) / 60)),
      t('time.second', Math.round((timeInSeconds % 3600) % 60)),
    ].join(' ');
  }
  return t('time.second', Math.round((timeInSeconds % 3600) % 60));
}

export function timeConversionRounded(timeInSeconds: number) {
  const { t } = useNuxtApp().$i18n;
  // time >= 63 minutes  :(1 hours (floored) 5 minutes (rounds by 5m)..)
  if (timeInSeconds >= 60 * 63) {
    return [
      t('time.hour', Math.floor(timeInSeconds / 3600)),
      t('time.minute', Math.round((timeInSeconds % 3600) / 60 / 5) * 5),
    ].join(' ');
  }
  // time : 58-62 minutes : (1 hour)
  if (timeInSeconds >= 60 * 58) {
    return t('time.hour', 1);
  }
  // time > 10 minutes : (10m..55m (rounds by 5m))
  if (timeInSeconds > 60 * 10) {
    return t('time.minute', Math.round(timeInSeconds / 60 / 5) * 5);
  }
  // time >= 55 seconds : (1m..10m (rounds by 1m))
  if (timeInSeconds >= 55) {
    return t('time.minute', Math.round(timeInSeconds / 60));
  }
  // time > 5 seconds : (10s..55s (ceils by 5s))
  if (timeInSeconds > 5) {
    return t('time.second', Math.ceil(timeInSeconds / 5) * 5);
  }
  // time <= 5 seconds : (< 5 seconds)
  return ['<', t('time.second', 5)].join(' ');
}
