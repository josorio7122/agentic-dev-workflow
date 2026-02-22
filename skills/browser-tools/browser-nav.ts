#!/usr/bin/env npx tsx

import puppeteer, { Browser, Page } from "puppeteer-core";

const args = process.argv.slice(2);
const newTab = args.includes("--new");
const reload = args.includes("--reload");
const url = args.find((a) => !a.startsWith("--"));

if (!url) {
	console.log("Usage: browser-nav.ts <url> [--new] [--reload]");
	console.log("\nExamples:");
	console.log("  browser-nav.ts https://example.com          # Navigate current tab");
	console.log("  browser-nav.ts https://example.com --new    # Open in new tab");
	console.log("  browser-nav.ts https://example.com --reload # Navigate and force reload");
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

if (newTab) {
	const p: Page = await b.newPage();
	await p.goto(url, { waitUntil: "domcontentloaded" });
	console.log("✓ Opened:", url);
} else {
	const p = (await b.pages()).at(-1) as Page;
	await p.goto(url, { waitUntil: "domcontentloaded" });
	if (reload) {
		await p.reload({ waitUntil: "domcontentloaded" });
	}
	console.log("✓ Navigated to:", url);
}

await b.disconnect();
