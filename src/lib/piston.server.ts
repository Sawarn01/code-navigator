/**
 * Thin client for a self-hosted Piston instance sitting behind an Nginx
 * reverse proxy that requires an API key. Server-only.
 */

export type ExecResult = {
  stdout: string;
  stderr: string;
  status: "success" | "runtime_error" | "compile_error" | "timeout";
  exitCode: number | null;
  time: number | null;
  memory: number | null;
};

export class ExecutionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionServiceError";
  }
}

const FILE_NAMES: Record<string, string> = {
  javascript: "main.js",
  typescript: "main.ts",
  python: "main.py",
  java: "Main.java",
  cpp: "main.cpp",
  "c++": "main.cpp",
  c: "main.c",
  go: "main.go",
};

export function sqlHarness(setup: string, query: string): string {
  const s = JSON.stringify(setup);
  const q = JSON.stringify(query);
  return [
    "import sqlite3, sys",
    `SETUP = ${s}`,
    `QUERY = ${q}`,
    "con = sqlite3.connect(':memory:')",
    "cur = con.cursor()",
    "cur.executescript(SETUP)",
    "try:",
    "    rows = cur.execute(QUERY).fetchall()",
    "except Exception as e:",
    "    print('SQL error:', e, file=sys.stderr)",
    "    sys.exit(1)",
    "for r in rows:",
    "    print('|'.join('' if v is None else (('%g' % v) if isinstance(v, float) and v == int(v) else str(v)) for v in r))",
    "",
  ].join("\n");
}

export async function executeOnPiston(params: {
  pistonLanguage: string;
  pistonVersion: string;
  source: string;
  stdin: string;
  timeoutMs: number;
  memoryMb: number;
}): Promise<ExecResult> {
  const base = process.env["PISTON_URL"];
  const key = process.env["PISTON_API_KEY"];
  if (!base || !key) {
    throw new ExecutionServiceError(
      "Execution service is not configured (PISTON_URL / PISTON_API_KEY missing).",
    );
  }

  const url = `${base.replace(/\/+$/, "")}/api/v2/execute`;
  const fileName = FILE_NAMES[params.pistonLanguage.toLowerCase()] ?? "main.txt";

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "X-API-Key": key,
      },
      body: JSON.stringify({
        language: params.pistonLanguage,
        version: params.pistonVersion,
        files: [{ name: fileName, content: params.source }],
        stdin: params.stdin,
        run_timeout: params.timeoutMs,
        compile_timeout: 10000,
        run_memory_limit: params.memoryMb * 1024 * 1024,
      }),
    });
  } catch (e) {
    throw new ExecutionServiceError(
      `Could not reach the execution service: ${(e as Error).message}`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ExecutionServiceError(
      `Execution service responded with ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }

  let payload: {
    run?: {
      stdout?: string;
      stderr?: string;
      code?: number | null;
      signal?: string | null;
      cpu_time?: number;
      wall_time?: number;
      memory?: number;
    };
    compile?: { stdout?: string; stderr?: string; code?: number | null };
    message?: string;
  };
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    throw new ExecutionServiceError("Execution service returned an unreadable response.");
  }

  if (!payload.run) {
    throw new ExecutionServiceError(payload.message ?? "Execution service returned no run result.");
  }

  const compileFailed = payload.compile && (payload.compile.code ?? 0) !== 0;
  const run = payload.run;
  const signal = run.signal ?? null;

  const status: ExecResult["status"] = compileFailed
    ? "compile_error"
    : signal === "SIGKILL" || signal === "SIGXCPU"
      ? "timeout"
      : (run.code ?? 0) !== 0
        ? "runtime_error"
        : "success";

  return {
    stdout: run.stdout ?? "",
    stderr: compileFailed ? (payload.compile?.stderr ?? "") : (run.stderr ?? ""),
    status,
    exitCode: run.code ?? null,
    time: run.wall_time ?? run.cpu_time ?? null,
    memory: run.memory ?? null,
  };
}
