import { aiTextToNodes } from "@/lib/lessonnotes/aiToNodes";
const t = `Condense the following logarithmic expression into a single logarithm: log_{2} 4 + log_{2} x + log_{2} y
log_{2} (4 × x × y) (Apply the product rule for logarithms)
Recall: log_b (M × N) = log_b M + log_b N
This is a plain sentence with no mathematics at all.`;
console.log(JSON.stringify(aiTextToNodes(t), null, 1));
