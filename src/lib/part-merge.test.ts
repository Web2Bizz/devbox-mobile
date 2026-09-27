import { test } from "node:test"
import assert from "node:assert/strict"
import { applyIncomingParts } from "./part-merge.ts"
import type { Part } from "./sdk.ts"

const part = (id: string, messageID: string, text?: string): Part => ({
  id,
  messageID,
  type: "text",
  text,
})

test("empty incoming returns the map untouched (same identity)", () => {
  const current = { m1: [part("p1", "m1", "hi")] }
  assert.equal(applyIncomingParts(current, "m1", []), current)
})

test("known part is replaced (streaming growth), order preserved", () => {
  const out = applyIncomingParts({ m1: [part("p1", "m1", "hel"), part("p2", "m1", "x")] }, "m1", [
    part("p1", "m1", "hello"),
  ])
  assert.deepEqual(out.m1.map((p) => [p.id, p.text]), [
    ["p1", "hello"],
    ["p2", "x"],
  ])
})

test("unknown parts append in snapshot order, other messages untouched", () => {
  const out = applyIncomingParts({ m1: [part("p1", "m1", "a")], m2: [part("q", "m2", "z")] }, "m1", [
    part("p2", "m1", "b"),
    part("p3", "m1", "c"),
  ])
  assert.deepEqual(out.m1.map((p) => p.id), ["p1", "p2", "p3"])
  assert.deepEqual(out.m2.map((p) => p.id), ["q"])
})

test("missing message bucket is created", () => {
  const out = applyIncomingParts({}, "m9", [part("p1", "m9", "hi")])
  assert.deepEqual(out.m9.map((p) => p.id), ["p1"])
})
