#!/usr/bin/env npx tsx

import puppeteer, { Browser, Page } from "puppeteer-core";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

// Global timeout - exit if script takes too long
const TIMEOUT = 30000;
const timeoutId = setTimeout(() => {
	console.error("✗ Timeout after 30s");
	process.exit(1);
}, TIMEOUT).unref();

const url = process.argv[2];

if (!url) {
	console.log("Usage: browser-content.ts <url>");
	console.log("\nExtracts readable content from a URL as markdown.");
	console.log("\nExamples:");
	console.log("  browser-content.ts https://example.com");
	console.log("  browser-content.ts https://en.wikipedia.org/wiki/Rust_(programming_language)");
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

await Promise.race([
	p.goto(url, { waitUntil: "networkidle2" }),
	new Promise<void>((r) => setTimeout(r, 10000)),
]).catch(() => {});

// Get HTML via CDP (works even with TrustedScriptURL restrictions)
const client = await p.createCDPSession();
const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true });
const { outerHTML } = await client.send("DOM.getOuterHTML", { nodeId: root.nodeId });
await client.detach();

const finalUrl = p.url();

// Extract with Readability
const doc = new JSDOM(outerHTML, { url: finalUrl });
const reader = new Readability(doc.window.document);
const article = reader.parse();

// Convert to markdown
function htmlToMarkdown(html: string): string {
	const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
	turndown.use(gfm);
	turndown.addRule("removeEmptyLinks", {
		filter: (node: HTMLElement) => node.nodeName === "A" && !node.textContent?.trim(),
		replacement: () => "",
	});
	return turndown
		.turndown(html)
		.replace(/\[\\?\[\s*\\?\]\]\([^)]*\)/g, "")
		.replace(/ +/g, " ")
		.replace(/\s+,/g, ",")
		.replace(/\s+\./g, ".")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

let content: string;
if (article?.content) {
	content = htmlToMarkdown(article.content);
} else {
	// Fallback
	const fallbackDoc = new JSDOM(outerHTML, { url: finalUrl });
	const fallbackBody = fallbackDoc.window.document;
	fallbackBody.querySelectorAll("script, style, noscript, nav, header, footer, aside").forEach((el) => el.remove());
	const main = fallbackBody.querySelector("main, article, [role='main'], .content, #content") ?? fallbackBody.body;
	const fallbackHtml = main?.innerHTML ?? "";
	if (fallbackHtml.trim().length > 100) {
		content = htmlToMarkdown(fallbackHtml);
	} else {
		content = "(Could not extract content)";
	}
}

console.log(`URL: ${finalUrl}`);
if (article?.title) console.log(`Title: ${article.title}`);
console.log("");
console.log(content);

process.exit(0);
