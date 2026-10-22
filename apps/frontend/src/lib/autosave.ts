/** Idle time after the last edit before an autosave is sent. */
export const AUTOSAVE_DELAY_MS = 1000;

export interface AutosaveOptions {
  /**
   * Saves whatever is unsaved and resolves true when nothing is left to save (including when
   * the state is already clean) or false when it could not be saved.
   */
  save: (autosave: boolean) => Promise<boolean>;
}

export interface AutosaveController {
  /** (Re)starts the idle timer; call after every edit that leaves something unsaved. */
  schedule: () => void;
  /** Drops the timer and any queued follow-up. A save already in flight is not aborted. */
  cancel: () => void;
  /** Explicit save: cancels the timer and saves now. During a save it queues a follow-up instead. */
  saveNow: () => Promise<boolean>;
  /** Saves what is pending before leaving: waits for an in-flight save, then saves again. */
  flush: () => Promise<boolean>;
}

/**
 * Debounces saves and keeps one in flight at a time. Timers that fire during a save queue a
 * single follow-up of the latest state. A failure drops the queue and arms nothing: the next
 * `schedule` (an edit) or an explicit save restarts saving.
 */
export function createAutosave({ save }: AutosaveOptions): AutosaveController {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<boolean> | undefined;
  let queued = false;
  // The queued follow-up was asked for by an explicit save, so it must add a version.
  let queuedExplicit = false;

  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function run(autosave: boolean): Promise<boolean> {
    const current = save(autosave).then(
      (ok) => ok,
      () => false,
    );
    inFlight = current;
    void current.then((ok) => {
      if (inFlight === current) inFlight = undefined;
      const followUp = ok && queued;
      const explicit = queuedExplicit;
      queued = false;
      queuedExplicit = false;
      if (followUp) void run(!explicit);
    });
    return current;
  }

  function fire() {
    timer = undefined;
    if (inFlight) queued = true;
    else void run(true);
  }

  return {
    schedule() {
      clearTimer();
      timer = setTimeout(fire, AUTOSAVE_DELAY_MS);
    },
    cancel() {
      clearTimer();
      queued = false;
      queuedExplicit = false;
    },
    saveNow() {
      clearTimer();
      if (inFlight) {
        queued = true;
        queuedExplicit = true;
        return inFlight;
      }
      return run(false);
    },
    async flush() {
      clearTimer();
      queued = false;
      queuedExplicit = false;
      if (inFlight) await inFlight;
      return run(true);
    },
  };
}
