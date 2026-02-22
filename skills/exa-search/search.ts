#!/usr/bin/env npx tsx

import Exa from "exa-js";

const args = process.argv.slice(2);

function extractFlag(flag: string): boolean {
	const i = args.indexOf(flag);
	if (i === -1) return false;
	args.splice(i, 1);
	return true;
}

function extractOption(flag: string): string | null {
	const i = args.indexOf(flag);
	if (i === -1 || !args[i + 1]) return null;
	const val = args[i + 1];
	args.splice(i, 2);
	return val;
}

const fetchContent    = extractFlag("--content");
const fetchHighlights = extractFlag("--highlights");
const fetchSummary    = extractFlag("--summary");

const numResults = parseInt(extractOption("-n") ?? "5", 10);
const type       = extractOption("--type")     ?? "auto";    // auto | neural | keyword
const category   = extractOption("--category") ?? undefined; // news | tweet | github | pdf | paper | ...
const domain     = extractOption("--domain")   ?? undefined;
const after      = extractOption("--after")    ?? undefined; // YYYY-MM-DD
const before     = extractOption("--before")   ?? undefined; // YYYY-MM-DD

const query = args.join(" ").trim();

if (!query) {
	console.log("Usage: search.ts <query> [options]");
	console.log("\nOptions:");
	console.log("  -n <num>           Number of results (default: 5)");
	console.log("  --type <type>      Search type: auto (default), neural, keyword");
	console.log("  --content          Include full page text");
	console.log("  --highlights       Include content highlights (shorter than --content)");
	console.log("  --summary          Include AI-generated summary of each result");
	console.log("  --category <cat>   Filter: news, tweet, github, pdf, paper, company, research report, ...");
	console.log("  --domain <domain>  Restrict results to a single domain (e.g. github.com)");
	console.log("  --after <date>     Only results published after YYYY-MM-DD");
	console.log("  --before <date>    Only results published before YYYY-MM-DD");
	console.log("\nEnvironment:");
	console.log("  EXA_API_KEY        Required. Your Exa API key.");
	console.log("\nExamples:");
	console.log('  search.ts "javascript async await"');
	console.log('  search.ts "rust ownership" --content -n 3');
	console.log('  search.ts "AI news" --category news --after 2025-01-01 --highlights');
	console.log('  search.ts "react hooks" --domain github.com --type keyword');
	process.exit(1);
}

const apiKey = process.env.EXA_API_KEY;
if (!apiKey) {
	console.error("Error: EXA_API_KEY environment variable is not set.");
	console.error("Get your API key at: https://dashboard.exa.ai/api-keys");
	process.exit(1);
}

const exa = new Exa(apiKey);

try {
	const searchOpts = {
		numResults: Math.min(numResults, 20),
		type,
		...(category && { category }),
		...(domain   && { includeDomains: [domain] }),
		...(after    && { startPublishedDate: new Date(after).toISOString() }),
		...(before   && { endPublishedDate:   new Date(before).toISOString() }),
	} as const;

	let results: Awaited<ReturnType<typeof exa.search>>["results"];

	if (fetchContent || fetchHighlights || fetchSummary) {
		const contentsOpts = {
			...searchOpts,
			...(fetchContent    && { text: { maxCharacters: 5000 } }),
			...(fetchHighlights && { highlights: { numSentences: 3, highlightsPerUrl: 3 } }),
			...(fetchSummary    && { summary: true }),
		};
		const res = await exa.searchAndContents(query, contentsOpts);
		results = res.results;
	} else {
		const res = await exa.search(query, searchOpts);
		results = res.results;
	}

	if (!results || results.length === 0) {
		console.log("No results found.");
		process.exit(0);
	}

	for (let i = 0; i < results.length; i++) {
		const r = results[i];
		console.log(`--- Result ${i + 1} ---`);
		console.log(`Title: ${r.title ?? "(no title)"}`);
		console.log(`Link: ${r.url}`);
		if (r.publishedDate) console.log(`Published: ${r.publishedDate.slice(0, 10)}`);
		if ("author" in r && r.author)       console.log(`Author: ${r.author}`);
		if (r.score != null) console.log(`Score: ${r.score.toFixed(4)}`);

		if ("summary" in r && r.summary)       console.log(`Summary:\n${r.summary}`);
		if ("highlights" in r && r.highlights) console.log(`Highlights:\n${(r.highlights as string[]).map((h) => `  • ${h}`).join("\n")}`);
		if ("text" in r && r.text)             console.log(`Content:\n${(r.text as string).trim()}`);

		console.log("");
	}
} catch (e) {
	console.error(`Error: ${(e as Error).message}`);
	process.exit(1);
}
