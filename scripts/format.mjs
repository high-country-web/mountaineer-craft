import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const prettier = spawnSync(
  process.execPath,
  [join(root, "node_modules/prettier/bin/prettier.cjs"), ".", check ? "--check" : "--write"],
  { cwd: root, stdio: "inherit" },
);
if (prettier.error) throw prettier.error;
if (prettier.status !== 0) process.exit(prettier.status ?? 1);

function goFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return ["vendor", "node_modules", ".git"].includes(entry.name) ? [] : goFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".go") ? [path] : [];
  });
}

const files = goFiles(join(root, "backend"));
if (files.length) {
  const gofmt = spawnSync("gofmt", [check ? "-l" : "-w", ...files], {
    cwd: root,
    encoding: "utf8",
  });
  if (gofmt.error) throw gofmt.error;
  if (gofmt.stderr) process.stderr.write(gofmt.stderr);
  if (gofmt.status !== 0) process.exit(gofmt.status ?? 1);
  if (check && gofmt.stdout.trim()) {
    process.stderr.write(`Go files need formatting:\n${gofmt.stdout}`);
    process.exit(1);
  }
  process.stdout.write(check ? "All Go files are formatted.\n" : "Formatted all Go files.\n");
}
