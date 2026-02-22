#!/usr/bin/env npx tsx

import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer, { Browser, Page } from "puppeteer-core";

const b = (await Promise.race([
	puppeteer.connect({
		browserURL: "http://localhost:9222",
		defaultViewport: null,
	}),
	new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
]).catch((e: Error) => {
	console.error("✗ Could not connect to browser:", e.message);
	console.error("  Run: browser-start.ts");
	process.exit(1);
})) as Browser;

const p = (await b.pages()).at(-1) as Page | undefined;

if (!p) {
	console.error("✗ No active tab found");
	process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const filename = `screenshot-${timestamp}.png`;
const filepath = join(tmpdir(), filename);

await p.screenshot({ path: filepath });

console.log(filepath);

await b.disconnect();
