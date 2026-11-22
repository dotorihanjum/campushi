import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
import { parseEnv } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const frontend = path.join(root, "frontend");
const localEnv = path.join(frontend, ".env.local");
if (existsSync(localEnv))
  for (const [key, value] of Object.entries(parseEnv(readFileSync(localEnv, "utf8"))))
    if (process.env[key] === undefined) process.env[key] = value;

const windows = process.platform === "win32";
const python = path.join(
  root,
  "backend",
  ".venv",
  windows ? "Scripts/python.exe" : "bin/python",
);
const requirements = path.join(root, "backend", "requirements.txt");
const marker = path.join(root, "backend", ".venv", ".requirements");
const setupOnly = process.argv.includes("--setup");
// 백엔드(계정 기능)가 쓰는 환경변수. 로컬에서는 frontend/.env.local(커밋하지 않음)에 Vercel과 같은 이름으로 두고,
// 이미 셸에 있는 값이 먼저다. 백엔드 프로세스에만 넘기고 Vite에는 넘기지 않는다(Vite는 VITE_로 시작하는 것만 브라우저에 싣는다).
const BACKEND_ENV = ["VITE_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SESSION_MAX_AGE_DAYS"];
const children = [];
let stopping = false;

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw new Error(`${command} 실행에 실패했습니다.`);
}
// KEY=VALUE 줄만 읽는다(# 주석, 빈 줄, 따옴표로 감싼 값 지원). 파일이 없으면 빈 객체.
function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    values[key] = /^(["']).*\1$/.test(raw) ? raw.slice(1, -1) : raw;
  }
  return values;
}
function backendEnv() {
  const local = readEnvFile(path.join(frontend, ".env.local"));
  const env = { ...process.env };
  for (const key of BACKEND_ENV) if (env[key] === undefined && local[key] !== undefined) env[key] = local[key];
  return env;
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (windows && child.pid)
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    else child.kill("SIGTERM");
  }
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
process.on("exit", () => {
  for (const child of children) child.kill();
});

try {
  if (
    !setupOnly &&
    !existsSync(path.join(frontend, "node_modules/vite/bin/vite.js"))
  ) {
    if (!process.env.npm_execpath)
      throw new Error("프로젝트 폴더에서 npm start를 실행해주세요.");
    console.log("프런트엔드 패키지를 설치합니다.");
    run(process.execPath, [process.env.npm_execpath, "ci"], frontend);
  }
  if (!process.env.API_TARGET || setupOnly) {
    if (!existsSync(python)) {
      const candidate = ["python3", "python", ...(windows ? ["py"] : [])].find(
        (command) => {
          const result = spawnSync(
            command,
            [
              "-c",
              "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)",
            ],
            { windowsHide: true, timeout: 5000 },
          );
          return result.status === 0;
        },
      );
      if (!candidate)
        throw new Error("Python 3.10 이상을 설치하고 다시 실행해주세요.");
      console.log("백엔드 실행 환경을 준비합니다.");
      run(candidate, ["-m", "venv", "backend/.venv"]);
    }
    const requested = readFileSync(requirements, "utf8");
    if (!existsSync(marker) || readFileSync(marker, "utf8") !== requested) {
      run(python, ["-m", "pip", "install", "-r", requirements]);
      writeFileSync(marker, requested);
    }
  }
  if (setupOnly) process.exit(0);
  if (!process.env.API_TARGET) {
    const port = Number(process.env.API_PORT || 8000);
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once("error", () =>
        reject(
          new Error(
            `${port} 포트가 사용 중입니다. API_PORT 환경변수로 다른 포트를 지정해주세요.`,
          ),
        ),
      );
      probe.listen(port, "127.0.0.1", () => probe.close(resolve));
    });
    const server = spawn(
      python,
      [
        "-m",
        "uvicorn",
        "backend.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      { cwd: root, stdio: "inherit", windowsHide: true, env: backendEnv() },
    );
    children.push(server);
    server.once("error", (error) => {
      console.error(error.message);
      stop(1);
    });
    server.once("exit", (code) => {
      if (!stopping) stop(code || 1);
    });
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try {
        const result = await fetch(`http://127.0.0.1:${port}/api/health`, {
          signal: AbortSignal.timeout(1000),
        });
        if (result.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready)
      throw new Error(
        "백엔드를 시작하지 못했습니다. 위 오류 내용을 확인해주세요.",
      );
  }
  const vite = spawn(
    process.execPath,
    [path.join(frontend, "node_modules/vite/bin/vite.js"), ...process.argv.slice(2)],
    { cwd: frontend, stdio: "inherit", windowsHide: true },
  );
  children.push(vite);
  vite.once("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  vite.once("exit", (code) => stop(code || 0));
} catch (error) {
  console.error(error.message);
  stop(1);
}
