import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateDirectoryPicker,
  validateFilePicker,
  validateProbe,
  validateSafePath,
  validateSettingsApply,
} from "../src/main/validation";

describe("desktop IPC payload validation", () => {
  it("accepts a bounded settings draft and normalizes no secret material", () => {
    expect(
      validateSettingsApply({
        revision: 4,
        values: { worker_concurrency: 1, nested: { enabled: false } },
        secrets: {
          telegram_bot_token: { operation: "set", value: "new-secret" },
          telegram_api_hash: { operation: "unchanged" },
        },
        runProbes: true,
      }),
    ).toEqual({
      revision: 4,
      values: { worker_concurrency: 1, nested: { enabled: false } },
      secrets: {
        telegram_bot_token: { operation: "set", value: "new-secret" },
        telegram_api_hash: { operation: "unchanged" },
      },
      runProbes: true,
    });
  });

  it("accepts only the two explicit data-directory migration choices", () => {
    for (const dataMigration of ["copy", "use-empty"] as const) {
      expect(validateSettingsApply({
        revision: 1,
        values: { data_dir: "/tmp/bento-new-data" },
        secrets: {},
        dataMigration,
      }).dataMigration).toBe(dataMigration);
    }
    expect(() => validateSettingsApply({
      revision: 1,
      values: { data_dir: "/tmp/bento-new-data" },
      secrets: {},
      dataMigration: "merge",
    })).toThrow(/dataMigration/i);
  });

  it.each([
    null,
    [],
    { revision: -1, values: {}, secrets: {} },
    { revision: 0.5, values: {}, secrets: {} },
    { revision: 0, values: {}, secrets: {}, command: "rm" },
    { revision: 0, values: { "../escape": true }, secrets: {} },
    { revision: 0, values: { unsafe: Number.POSITIVE_INFINITY }, secrets: {} },
    { revision: 0, values: {}, secrets: { token: { operation: "set", value: "", extra: true } } },
    { revision: 0, values: {}, secrets: { token: { operation: "read" } } },
    { revision: 0, values: {}, secrets: {}, runProbes: "yes" },
  ])("rejects hostile settings payload %#", (payload) => {
    expect(() => validateSettingsApply(payload)).toThrow(TypeError);
  });

  it("rejects excessive nesting and oversized drafts", () => {
    let nested: Record<string, unknown> = { leaf: true };
    for (let index = 0; index < 10; index += 1) nested = { nested };
    expect(() => validateSettingsApply({ revision: 0, values: nested, secrets: {} })).toThrow(/deep/i);
    expect(() =>
      validateSettingsApply({ revision: 0, values: { payload: "x".repeat(1_048_577) }, secrets: {} }),
    ).toThrow(/large/i);
  });

  it("allows only explicit, bounded probe kinds and absolute non-root paths", () => {
    const candidate = path.join(path.parse(process.cwd()).root, "tmp", "bento-data");
    expect(validateProbe({ kind: "writable-directory", path: candidate, secrets: {} })).toEqual({
      kind: "writable-directory",
      path: candidate,
      secrets: {},
    });

    for (const payload of [
      { kind: "shell", path: candidate },
      { kind: "writable-directory", path: "../../etc" },
      { kind: "writable-directory", path: `${candidate}\0suffix` },
      { kind: "telegram", secrets: { "bad-key": "secret" } },
      { kind: "telegram", secrets: { token: "" } },
      { kind: "telegram", extra: true },
    ]) {
      expect(() => validateProbe(payload)).toThrow(TypeError);
    }
    expect(() => validateSafePath(path.parse(process.cwd()).root)).toThrow(/root/i);
  });

  it("rejects picker payload injection and unsafe filters", () => {
    expect(validateDirectoryPicker(undefined)).toEqual({ title: undefined });
    expect(validateFilePicker({ filters: [{ name: "Images", extensions: ["PNG", "jpg"] }] })).toEqual({
      title: undefined,
      filters: [{ name: "Images", extensions: ["png", "jpg"] }],
    });

    for (const payload of [
      { title: "Open\nfile" },
      { title: "Open", properties: ["showHiddenFiles"] },
      { filters: [{ name: "Any", extensions: ["*"] }] },
      { filters: [{ name: "Any", extensions: ["../exe"] }] },
      { filters: [{ name: "Any", extensions: [], extra: true }] },
    ]) {
      expect(() => validateFilePicker(payload)).toThrow(TypeError);
    }
  });
});
