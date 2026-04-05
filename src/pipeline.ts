import { requestUrl } from "obsidian";
import type { TubeScribeSettings } from "./settings";

export interface PipelineResult {
  titles: string[];
  descriptionEn: string;
  descriptionJp: string;
  tags: string[];
  generatedAt: string;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface ContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: ContentBlock[];
  stop_reason: string;
}

function buildSystemPrompt(settings: TubeScribeSettings): string {
  const searchBlock = settings.useWebSearch
    ? `You have access to web search. Do 1-2 focused searches to:
- Find what top-performing similar videos are titled (study the patterns)
- Identify high-volume search terms for this specific topic/location

Keep searches targeted — do not do more than 2 searches.`
    : `You do NOT have web search for this run. Use your knowledge of YouTube SEO, walking video trends, and Japan tourism keywords to generate the best metadata possible.`;

  return `You are a YouTube SEO specialist for a Japan walking video channel.

Channel context: ${settings.channelContext}

Your job is to generate YouTube metadata that maximizes discoverability while staying authentic to the channel's voice.

${searchBlock}

Always respond with a valid JSON object only — no markdown, no preamble, no explanation.`;
}

function buildUserPrompt(
  noteContent: string,
  settings: TubeScribeSettings
): string {
  const { titleCount, tagCount, languageOutput } = settings;

  const descriptionExtras: string[] = [];
  if (settings.includeTimestamps) {
    descriptionExtras.push("Include a Timestamps/Chapters section with 4-6 placeholder entries like '0:00 - Start / Arrival at [location]', '2:30 - [landmark or scene]'. Use realistic intervals for a walking video.");
  }
  if (settings.includeLinks) {
    descriptionExtras.push("End with a Links section containing placeholders: Subscribe link, social media, and 2-3 related video suggestions.");
  }
  const extrasBlock = descriptionExtras.length > 0
    ? "\n\nDescription extras:\n" + descriptionExtras.map(e => `- ${e}`).join("\n")
    : "";

  return `Generate YouTube metadata for this video note:

---
${noteContent}
---

${settings.useWebSearch ? "Do 1-2 web searches to research top-performing titles and search terms for this topic, then generate metadata." : "Generate metadata based on your knowledge of YouTube SEO and this niche."}

Return a JSON object with exactly this shape:
{
  "titles": [${titleCount} title options, ranked by estimated search performance],
  "descriptionEn": ${languageOutput !== "jp" ? '"SEO description in English. First 2 lines must hook viewers (visible before Show More). Include location, what viewers will experience, and natural keywords. 150-250 words total."' : '""'},
  "descriptionJp": ${languageOutput !== "en" ? '"SEO description in Japanese — written natively for JP YouTube audience, not translated from English. First 2 lines are the hook. 150-250 words. Use natural Japanese phrasing."' : '""'},
  "tags": [${tagCount} tags — include BOTH English and Japanese for each location/term (e.g. "shibuya", "渋谷"). Lead with long-tail keywords (e.g. "walking tour Shimokitazawa 2024"), then broader terms. Include alternate romanizations. No # prefix]
}

Title rules:
- Keep under 65 characters (YouTube truncates beyond this)
- Put the location/topic at the front
- Include markers like [4K] [Walking Tour] where relevant
- Study what the web search found — mirror patterns from high-view videos
- Feel written by a human, not an algorithm
${extrasBlock}
Return only the JSON object. No markdown fences. No explanation.`;
}

export async function runPipeline(
  noteContent: string,
  settings: TubeScribeSettings,
  onProgress: (msg: string) => void
): Promise<PipelineResult> {
  if (!settings.anthropicApiKey) {
    throw new Error(
      "No Anthropic API key set. Please add your key in TubeScribe settings."
    );
  }

  if (!noteContent.trim()) {
    throw new Error("Note is empty. Add some content about your video first.");
  }

  onProgress(settings.useWebSearch ? "Researching topic and trends..." : "Generating metadata...");

  const modelId = settings.model === "haiku"
    ? "claude-haiku-4-5-20251001"
    : "claude-sonnet-4-20250514";

  const messages: AnthropicMessage[] = [
    {
      role: "user",
      content: buildUserPrompt(noteContent, settings),
    },
  ];

  const requestBody: Record<string, unknown> = {
    model: modelId,
    max_tokens: 2000,
    system: buildSystemPrompt(settings),
    messages,
  };

  if (settings.useWebSearch) {
    requestBody.tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
      },
    ];
  }

  onProgress("Generating metadata with Claude...");

  const response = await requestUrl({
    url: "https://api.anthropic.com/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody),
    throw: false,
  });

  if (response.status >= 400) {
    const error = response.json ?? {};
    throw new Error(
      `Anthropic API error ${response.status}: ${(error as { error?: { message?: string } })?.error?.message ?? "Unknown error"}`
    );
  }

  const data = response.json as AnthropicResponse;

  onProgress("Parsing results...");

  // Extract final text block (last text block after tool use)
  const textBlocks = data.content.filter(
    (block) => block.type === "text" && block.text
  );

  if (textBlocks.length === 0) {
    throw new Error("No text response from Claude. Please try again.");
  }

  const rawText = textBlocks[textBlocks.length - 1].text ?? "";

  // Strip any accidental markdown fences
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: {
    titles?: string[];
    descriptionEn?: string;
    descriptionJp?: string;
    tags?: string[];
  };

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Could not parse Claude's response as JSON. Raw response:\n\n${rawText}`
    );
  }

  return {
    titles: parsed.titles ?? [],
    descriptionEn: parsed.descriptionEn ?? "",
    descriptionJp: parsed.descriptionJp ?? "",
    tags: parsed.tags ?? [],
    generatedAt: new Date().toISOString(),
  };
}

export function formatMetadataBlock(result: PipelineResult): string {
  const lines: string[] = [
    "",
    "---",
    "",
    "## 📺 YouTube Metadata",
    `*Generated by TubeScribe · ${new Date(result.generatedAt).toLocaleDateString()}*`,
    "",
  ];

  lines.push("### Titles");
  result.titles.forEach((title, i) => {
    lines.push(`${i + 1}. ${title}`);
  });

  if (result.descriptionEn) {
    lines.push("", "### Description (EN)");
    lines.push(result.descriptionEn);
  }

  if (result.descriptionJp) {
    lines.push("", "### Description (JP)");
    lines.push(result.descriptionJp);
  }

  if (result.tags.length > 0) {
    lines.push("", "### Tags");
    lines.push(result.tags.join(", "));
  }

  lines.push("", "---", "");

  return lines.join("\n");
}
