import { describe, expect, it } from "vitest";
import { LatestFrameScheduler } from "../capture/LatestFrameScheduler";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("LatestFrameScheduler", () => {
  it("processes the active and newest pending frame only", async () => {
    const first = deferred<number>();
    const processed: number[] = []; const released: number[] = []; const results: number[] = [];
    const scheduler = new LatestFrameScheduler<number, number>(async (item) => {
      processed.push(item); return item === 1 ? first.promise : item;
    }, (result) => results.push(result), (item) => released.push(item));
    scheduler.submit(1); scheduler.submit(2); scheduler.submit(3);
    expect(released).toEqual([2]);
    first.resolve(1); await new Promise((resolve) => setTimeout(resolve, 0));
    expect(processed).toEqual([1, 3]); expect(results).toEqual([1, 3]); expect(released).toEqual([2, 1, 3]);
  });

  it("releases pending work on stop", () => {
    const never = deferred<number>(); const released: number[] = [];
    const scheduler = new LatestFrameScheduler<number, number>(() => never.promise, () => undefined, (item) => released.push(item));
    scheduler.submit(1); scheduler.submit(2); scheduler.stop();
    expect(released).toEqual([2]);
  });
});
