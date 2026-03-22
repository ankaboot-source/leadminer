export type ToastHasLinksGroupDetail = {
  message: string;
  link?: {
    text: string;
    url: string;
  };
  button?: {
    text: string;
    action?: () => void;
  };
};

function isToastHasLinksGroupDetail(
  detail: unknown,
): detail is ToastHasLinksGroupDetail {
  return (
    typeof detail === 'object' &&
    detail !== null &&
    'message' in detail &&
    typeof detail.message === 'string'
  );
}

export function getToastHasLinksDetailMessage(detail: unknown) {
  if (typeof detail === 'string') {
    return detail;
  }

  if (isToastHasLinksGroupDetail(detail)) {
    return detail.message;
  }

  return '';
}

export function hasToastHasLinksButtonAction(detail: unknown) {
  return Boolean(
    isToastHasLinksGroupDetail(detail) &&
    typeof detail.button?.action === 'function',
  );
}

export function hasToastHasLinksLink(detail: unknown) {
  return Boolean(isToastHasLinksGroupDetail(detail) && detail.link?.url);
}

export function asToastHasLinksGroupDetail(detail: unknown) {
  if (isToastHasLinksGroupDetail(detail)) {
    return detail;
  }

  return undefined;
}
