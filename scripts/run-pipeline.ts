/** Run collect → generate once from your machine (uses .env.local). Handy for the first test. */
import { collect } from "../src/pipeline/collect";
import { generate } from "../src/pipeline/generate";

const step = process.argv[2] ?? "all";
if (step === "all" || step === "collect") console.log("collect:", (await collect()).summary);
if (step === "all" || step === "generate") console.log("generate:", (await generate()).summary);
