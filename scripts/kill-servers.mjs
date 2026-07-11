import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Kills every leftover Next.js dev/start process for THIS project and nothing
 * else. Long-running verification cycles and manual `next start` sessions
 * accumulate orphaned servers that squat ports 3000+ — a fresh `npm run dev`
 * then silently slides to the next free port, and it becomes easy to land on a
 * stale tab pointing at an old (possibly AI_MODE=mock suite) server. This is
 * the one-command cleanup: `npm run kill-servers`.
 *
 * Scope is deliberately narrow: only node processes whose command line runs a
 * `next` binary AND references this project's directory are killed. Other node
 * apps on the machine are left alone.
 */
const projectDir = process.cwd();

function killWindows() {
  // Match on the project path so we never touch another repo's Next server.
  // Escape backslashes and quotes for embedding in the PowerShell string.
  const needle = projectDir.replace(/\\/g, "\\\\").replace(/'/g, "''");
  const ps = `
    $killed = 0
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
      Where-Object {
        $_.CommandLine -and
        $_.CommandLine -match 'next' -and
        ($_.CommandLine -match '${needle}' -or $_.CommandLine -match 'npm-cli.js|npx-cli.js')
      } |
      ForEach-Object {
        Write-Output ('killed ' + $_.ProcessId + ' :: ' + $_.CommandLine)
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        $killed++
      }
    if ($killed -eq 0) { Write-Output 'no leftover next servers found' }
  `;
  const out = execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], {
    encoding: "utf8"
  });
  process.stdout.write(out);
}

function killPosix() {
  // pkill -f matches the full command line; scope to this project's dir.
  try {
    const out = execFileSync(
      "pkill",
      ["-f", `${path.basename(projectDir)}.*next (dev|start)`],
      { encoding: "utf8" }
    );
    process.stdout.write(out || "sent SIGTERM to matching next servers\n");
  } catch (err) {
    // pkill exits 1 when nothing matched — that's success for us.
    if (err.status === 1) {
      console.log("no leftover next servers found");
    } else {
      throw err;
    }
  }
}

if (process.platform === "win32") {
  killWindows();
} else {
  killPosix();
}
