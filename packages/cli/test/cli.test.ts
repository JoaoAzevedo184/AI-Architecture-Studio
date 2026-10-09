import { describe, expect, it } from "vitest";
import { DEFAULT_PORT, UsageError, parseCliArgs } from "../src/args.js";
import { PortInUseError, startOnFreePort } from "../src/ports.js";

describe("parseCliArgs", () => {
  it("defaults", () => {
    expect(parseCliArgs([], {})).toEqual({ help: false, version: false, open: true, port: DEFAULT_PORT, portExplicit: false });
  });

  it("parses flags", () => {
    expect(parseCliArgs(["--no-open", "--help", "-v"], {})).toMatchObject({ open: false, help: true, version: true });
    expect(parseCliArgs(["--port", "5000"], {})).toMatchObject({ port: 5000, portExplicit: true });
    expect(parseCliArgs(["--port=5001"], {})).toMatchObject({ port: 5001 });
  });

  it("--port wins over ARQUITECTURE_PORT, which wins over the default", () => {
    expect(parseCliArgs(["--port", "6000"], { ARQUITECTURE_PORT: "7000" }).port).toBe(6000);
    const env = parseCliArgs([], { ARQUITECTURE_PORT: "7000" });
    expect(env.port).toBe(7000);
    expect(env.portExplicit).toBe(false);
    expect(parseCliArgs([], { ARQUITECTURE_PORT: "" }).port).toBe(DEFAULT_PORT);
  });

  it("rejects invalid ports and unknown options with a Portuguese message", () => {
    for (const argv of [["--port", "abc"], ["--port", "70000"], ["--port", "-1"], ["--port"], ["--nope"], ["extra"]]) {
      expect(() => parseCliArgs(argv, {})).toThrow(UsageError);
    }
    expect(() => parseCliArgs([], { ARQUITECTURE_PORT: "x" })).toThrow(/ARQUITECTURE_PORT/);
    expect(() => parseCliArgs(["--port", "abc"], {})).toThrow(/Porta inválida/);
  });
});

const busy = () => Object.assign(new Error("in use"), { code: "EADDRINUSE" });

describe("startOnFreePort", () => {
  it("uses the requested port when free", async () => {
    expect((await startOnFreePort(4517, false, async (p) => p)).port).toBe(4517);
  });

  it("without explicit port, takes the first free one among the next ten", async () => {
    const tried: number[] = [];
    const r = await startOnFreePort(4517, false, async (p) => {
      tried.push(p);
      if (p < 4520) throw busy();
      return p;
    });
    expect(r.port).toBe(4520);
    expect(tried).toEqual([4517, 4518, 4519, 4520]);
  });

  it("tries start+10 as the last port and then gives up", async () => {
    const tried: number[] = [];
    await expect(
      startOnFreePort(4517, false, async (p) => {
        tried.push(p);
        throw busy();
      }),
    ).rejects.toThrow(PortInUseError);
    expect(tried).toHaveLength(11);
    expect(tried.at(-1)).toBe(4527);
  });

  it("with explicit port, fails on the first busy port with a clear message", async () => {
    const tried: number[] = [];
    await expect(
      startOnFreePort(4517, true, async (p) => {
        tried.push(p);
        throw busy();
      }),
    ).rejects.toThrow(/porta 4517 já está em uso/);
    expect(tried).toEqual([4517]);
  });

  it("does not swallow other errors", async () => {
    await expect(startOnFreePort(4517, false, async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
  });

  it("does not scan past 65535", async () => {
    const tried: number[] = [];
    await expect(startOnFreePort(65534, false, async (p) => (tried.push(p), Promise.reject(busy())))).rejects.toThrow(PortInUseError);
    expect(tried).toEqual([65534, 65535]);
  });
});
