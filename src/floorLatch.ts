export interface OneShotLatch {
  tryFire(): boolean;
  reset(): void;
  fired(): boolean;
}

export function createOneShotLatch(): OneShotLatch {
  let isFired = false;
  return {
    tryFire(): boolean {
      if (isFired) {
        return false;
      }
      isFired = true;
      return true;
    },
    reset(): void {
      isFired = false;
    },
    fired(): boolean {
      return isFired;
    },
  };
}
