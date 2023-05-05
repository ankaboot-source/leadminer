/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDefaultState } from "./defaultState";

export function SET_LOADING(state: any, newLoadingStatus: any) {
  state.loadingStatus = newLoadingStatus;
}
export function SET_LOADING_DNS(state: any, newLoadingStatusDns: any) {
  state.loadingStatusDns = newLoadingStatusDns;
}
export function SET_USERID(state: any, id: string) {
  state.userId = id;
}
export function SET_LOADINGBOX(state: any, newLoadingStatusbox: any) {
  state.loadingStatusbox = newLoadingStatusbox;
}
export function SET_IMAP(state: any, newImap: any) {
  state.imapUser = {
    ...newImap,
  };
}

export function SET_BOXES(state: any, newBoxes: any) {
  state.boxes = [...newBoxes];
}
export function SET_ERROR(state: any, newError: any) {
  state.errorMessage = newError;
}
export function SET_INFO_MESSAGE(state: any, newMessage: string) {
  state.infoMessage = newMessage;
}
export function SET_SESSIONID(state: any, newSocket: any) {
  state.socketId = newSocket;
}
export function SET_SCANNEDEMAILS(state: any, newValue: any) {
  state.progress.scannedEmails = newValue;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SET_EXTRACTEDEMAILS(state: any, newValue: any) {
  state.progress.extractedEmails = newValue;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SET_STATISTICS(state: any, newValue: any) {
  if (newValue === "f") {
    state.progress.statistics = {};
  } else {
    state.progress.statistics = newValue;
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SET_SCANNEDBOXES(state: any, newValue: any) {
  if (newValue.length === 0) {
    state.progress.scannedBoxes = newValue;
  } else {
    const boxesArray = [
      newValue
        .replace('\\"', '"')
        .replaceAll('"', "")
        .substring(newValue.indexOf("/"), newValue.length),
    ];

    boxesArray.push(...state.progress.scannedBoxes);
    state.progress.scannedBoxes = [...new Set(boxesArray)];
  }
}

export function SET_STATUS(state: any, newStatus: any) {
  state.progress.status = newStatus;
}

export function SET_GOOGLE_USER(state: any, user: any) {
  state.googleUser = {
    ...user,
  };
}

export function RESET_STORE(state: any) {
  Object.assign(state, getDefaultState());
}

export function SET_MINING_TASK(state: any, task: any) {
  state.miningTask = task;
}

export function DELETE_MINING_TASK(state: any) {
  state.miningTask = {};
}

export function SET_FETCHING_FINISHED(state: any, totalFetchedEmails: number) {
  state.fetchingFinished = totalFetchedEmails;
}

export function SET_ERRORS(state, errors) {
  const result = {};

  if (errors.length > 0) {
    errors.forEach(({ fields, message }) => {
      fields.forEach((field) => {
        result[field] = message;
      });
    });
  }
  state.errors = result;
}
