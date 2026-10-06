import test from "node:test";
import assert from "node:assert/strict";
import { idr, MAX_AMOUNT } from "../src/lib/money.ts";
import { appDate } from "../src/lib/app-date.ts";

test("rupiah formatting has no fractional digits", () => {
  assert.equal(idr(13000), "Rp 13.000");
  assert.equal(idr(-50000), "-Rp 50.000");
});

test("per-entry limit is one billion rupiah", () => {
  assert.equal(MAX_AMOUNT, 1_000_000_000);
});

test("simulated business date has a single development override", () => {
  const previousNodeEnv=process.env.NODE_ENV, previousSim=process.env.APP_SIMULATED_DATE;
  process.env.NODE_ENV="development";process.env.APP_SIMULATED_DATE="2026-09-30";
  assert.equal(appDate().toISOString(), "2026-09-30T12:00:00.000Z");
  if(previousNodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousNodeEnv;
  if(previousSim===undefined)delete process.env.APP_SIMULATED_DATE;else process.env.APP_SIMULATED_DATE=previousSim;
});
