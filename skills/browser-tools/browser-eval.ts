#!/usr/bin/env npx tsx

import puppeteer, { Browser, Page } from "puppeteer-core";

const code = process.argv.slice(2).join(" ");
if (!code) {
	console.log("Usage: browser-eval.ts 'code'");
	console.log("\nExamples:");
	console.log('  browser-eval.ts "document.title"');
	console.log('  browser-eval.ts "document.querySelectorAll(\'a\').length"');
	process.exit(1);
}

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

const result: unknown = await p.evaluate((c: string) => {
	const AsyncFunction = (async () => {}).constructor as new (...args: string[]) => () => Promise<unknown>;
	return new AsyncFunction(`return (${c})`)();
}, code);

if (Array.isArray(result)) {
	for (let i = 0; i < result.length; i++) {
		if (i > 0) console.log("");
		for (const [key, value] of Object.entries(result[i] as Record<string, unknown>)) {
			console.log(`${key}: ${value}`);
		}
	}
} else if (typeof result === "object" && result !== null) {
	for (const [key, value] of Object.entries(result as Record<string, unknown>)) {
		console.log(`${key}: ${value}`);
	}
} else {
	console.log(result);
}

await b.disconnect();
