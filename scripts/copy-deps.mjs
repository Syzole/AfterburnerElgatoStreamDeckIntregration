import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sdPlugin = path.join(root, "com.syzole.aftermonitor.sdPlugin");
const targetDir = path.join(sdPlugin, "node_modules", "koffi");
const sourceDir = path.join(root, "node_modules", "koffi");

if (!existsSync(sourceDir)) {
	throw new Error("koffi is not installed. Run npm install first.");
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(path.dirname(targetDir), { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Copied koffi to ${targetDir}`);
