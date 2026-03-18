import { vi } from "vitest";

export class ExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`);
    this.name = "ExitError";
  }
}

export function captureOutput() {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: any) => {
    stdoutChunks.push(String(chunk));
    return true;
  });

  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk: any) => {
    stderrChunks.push(String(chunk));
    return true;
  });

  return {
    stdoutSpy,
    stderrSpy,
    getStdout: () => stdoutChunks.join(""),
    getStderr: () => stderrChunks.join(""),
    getStdoutJson: () => JSON.parse(stdoutChunks.join("")),
    getStderrJson: () => {
      // log() also writes to stderr, so find the JSON chunk (starts with "{")
      const jsonChunk = stderrChunks.find(c => c.trimStart().startsWith("{"));
      if (!jsonChunk) throw new Error("No JSON found in stderr: " + stderrChunks.join(""));
      return JSON.parse(jsonChunk);
    },
  };
}

export function mockProcessExit() {
  return vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new ExitError(code ?? 0);
  }) as any);
}
