export function convertSeconds(timeInSeconds: number) {
  if (timeInSeconds >= 3600) {
    return [
      Math.floor(timeInSeconds / 3600),
      'hours',
      Math.round((timeInSeconds % 3600) / 60),
      'minutes',
      Math.round((timeInSeconds % 3600) % 60),
      'seconds',
    ].join(' ');
  }
  if (timeInSeconds >= 60) {
    return [
      Math.round((timeInSeconds % 3600) / 60),
      'minutes',
      Math.round((timeInSeconds % 3600) % 60),
      'seconds',
    ].join(' ');
  }
  return [Math.round((timeInSeconds % 3600) % 60), 'seconds'].join(' ');
}

export function timeConversionRounded(timeInSeconds: number) {
  // time >= 63 minutes  :(1 hours (floored) 5 minutes (rounds by 5m)..)
  if (timeInSeconds >= 60 * 63) {
    return [
      Math.floor(timeInSeconds / 3600),
      'hours',
      Math.round((timeInSeconds % 3600) / 60 / 5) * 5,
      'minutes',
    ];
  }
  // time : 58-62 minutes : (1 hour)
  if (timeInSeconds >= 60 * 58) {
    return [1, 'hour'].join(' ');
  }
  // time > 10 minutes : (10m..55m (rounds by 5m))
  if (timeInSeconds > 60 * 10) {
    return [Math.round(timeInSeconds / 60 / 5) * 5, 'minutes'].join(' ');
  }
  // time >= 55 seconds : (1m..10m (rounds by 1m))
  if (timeInSeconds >= 55) {
    return [Math.round(timeInSeconds / 60), 'minutes'].join(' ');
  }
  // time > 5 seconds : (10s..55s (ceils by 5s))
  if (timeInSeconds > 5) {
    return [Math.ceil(timeInSeconds / 5) * 5, 'seconds'].join(' ');
  }
  // time <= 5 seconds : (< 5 seconds)
  return ['< 5', 'seconds'].join(' ');
}
