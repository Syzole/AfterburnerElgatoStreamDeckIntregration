import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sdPlugin = path.join(root, "com.syzole.aftermonitor.sdPlugin");
const packages = ["koffi", "@napi-rs/canvas", "@napi-rs/canvas-win32-x64-msvc"];

function isLockError(error) {
	return error && (error.code === "EPERM" || error.code === "EBUSY" || error.code === "EACCES");
}

for (const name of packages) {
	const sourceDir = path.join(root, "node_modules", name);
	const targetDir = path.join(sdPlugin, "node_modules", name);

	if (!existsSync(sourceDir)) {
		if (name.includes("win32") && process.platform !== "win32") {
			continue;
		}

		throw new Error(`${name} is not installed. Run npm install first.`);
	}

	try {
		if (existsSync(targetDir)) {
			rmSync(targetDir, { recursive: true, force: true });
		}

		mkdirSync(path.dirname(targetDir), { recursive: true });
		cpSync(sourceDir, targetDir, { recursive: true });
		console.log(`Copied ${name} to ${targetDir}`);
	} catch (error) {
		if (isLockError(error) && existsSync(targetDir)) {
			console.warn(`Skipped ${name}: native files are locked by Stream Deck. Restart the plugin if this package changed.`);
			continue;
		}

		throw error;
	}
}
