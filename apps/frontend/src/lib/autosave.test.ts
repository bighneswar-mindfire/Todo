import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_DELAY_MS, createAutosave } from "./autosave";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("autosave controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires once, as an autosave, after the delay", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const autosave = createAutosave({ save });

    autosave.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(true);
  });

  it("restarts the delay on every schedule", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const autosave = createAutosave({ save });

    autosave.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does nothing after cancel", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const autosave = createAutosave({ save });

    autosave.schedule();
    autosave.cancel();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);

    expect(save).not.toHaveBeenCalled();
  });

  it("runs one follow-up save after an in-flight save, not two at once", async () => {
    const first = deferred<boolean>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(true);
    const autosave = createAutosave({ save });

    autosave.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);

    first.resolve(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(save).toHaveBeenCalledTimes(2);
  });

  it("does not repeat a failed save by itself", async () => {
    const first = deferred<boolean>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(true);
    const autosave = createAutosave({ save });

    autosave.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    first.resolve(false);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 3);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saveNow cancels the timer and saves at once as an explicit save", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const autosave = createAutosave({ save });

    autosave.schedule();
    await expect(autosave.saveNow()).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(false);
  });

  it("flush waits for the in-flight save, then saves what is left", async () => {
    const first = deferred<boolean>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(true);
    const autosave = createAutosave({ save });

    autosave.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    const flushed = autosave.flush();
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve(true);

    await expect(flushed).resolves.toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(true);
  });

  it("flush reports a failed save", async () => {
    const save = vi.fn().mockResolvedValue(false);
    const autosave = createAutosave({ save });

    await expect(autosave.flush()).resolves.toBe(false);
  });

  it("Unit: an explicit save queued behind a save in flight is sent as an explicit save", async () => {
    const first = deferred<boolean>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(true);
    const autosave = createAutosave({ save });
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenNthCalledWith(1, true);

    void autosave.saveNow();
    first.resolve(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenNthCalledWith(2, false);
  });

  it("Unit: a timer follow-up queued behind a save in flight stays an autosave", async () => {
    const first = deferred<boolean>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(true);
    const autosave = createAutosave({ save });
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

    first.resolve(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenNthCalledWith(2, true);
  });
});
