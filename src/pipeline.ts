import { requestUrl } from "obsidian";
import type { TubeScribeSettings } from "./settings";

export interface PipelineResult {
  searchTitles: string[];
  clickTitles: string[];
  descriptionEn: string;
  descriptionJp: string;
  hashtags: string[];
  tags: string[];
  thumbnailTexts: string[];
  pinnedComment: string;
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

Critical style rules:
- Write all descriptions in natural, semantic language. NEVER output pipe-separated keyword blocks (e.g. "Tokyo | Walking Tour | Sakura"). YouTube's algorithm reads natural language — keyword stuffing looks dated and hurts credibility for a premium channel.
- Mobile-first formatting: Most viewers read descriptions on phones. Use short paragraphs (2-3 sentences max) with blank lines between them for breathing room. No walls of text. Each paragraph should be scannable at a glance.
- For bilingual (EN+JP) descriptions, use the "metadata sandwich" structure: bilingual hook at the top, English body, divider, Japanese body. This doubles discovery entry points — English travelers, Japanese locals, and global Japanophiles who search in Japanese. The descriptions should feel like one unified piece, not two separate translations.

${searchBlock}

Always respond with a valid JSON object only — no markdown, no preamble, no explanation.`;
}

function buildUserPrompt(
  noteContent: string,
  settings: TubeScribeSettings
): string {
  const { titleCount, tagCount, languageOutput } = settings;

  const isShort = settings.videoType === "short";

  const descriptionExtras: string[] = [];
  if (!isShort && settings.includeTimestamps) {
    descriptionExtras.push("Include a Timestamps/Chapters section with 4-6 placeholder entries like '0:00 - Start / Arrival at [location]', '2:30 - [landmark or scene]'. Use realistic intervals for a walking video.");
  }
  if (!isShort && settings.includeLinks) {
    descriptionExtras.push("End with a Links section containing placeholders: Subscribe link, social media, and 2-3 related video suggestions.");
  }
  const extrasBlock = descriptionExtras.length > 0
    ? "\n\nDescription extras:\n" + descriptionExtras.map(e => `- ${e}`).join("\n")
    : "";

  if (isShort) {
    return `Generate YouTube Shorts metadata for this video note:

---
${noteContent}
---

${settings.useWebSearch ? "Do 1-2 web searches to research top-performing Shorts titles and trending hashtags for this topic." : "Generate metadata based on your knowledge of YouTube Shorts SEO and this niche."}

Return a JSON object with exactly this shape:
{
  "searchTitles": [${titleCount} search-optimized Shorts titles — keyword-focused, under 40 chars],
  "clickTitles": [${titleCount} click-optimized Shorts titles — hook immediately, curiosity or surprise, under 40 chars],
  "descriptionEn": ${languageOutput !== "jp" ? (languageOutput === "en+jp" ? '"Bilingual Shorts description: 1 punchy English sentence, then 1 punchy Japanese sentence. Keywords woven naturally."' : '"Short punchy description in English, 1-2 natural sentences max. Weave keywords into readable prose — no pipe-separated keyword lists."') : '""'},
  "descriptionJp": ${languageOutput !== "en" ? (languageOutput === "en+jp" ? '"" (leave empty — Japanese is included in descriptionEn above)' : '"Short punchy description in Japanese, 1-2 natural sentences max. Written natively, not translated. No pipe-separated keyword lists."') : '""'},
  "hashtags": [5 hashtags with # prefix. #Shorts MUST be first. Pick trending, high-impact terms.],
  "tags": [${tagCount} tags — include both English and Japanese for locations. No # prefix],
  "thumbnailTexts": [3 short text overlay suggestions for the thumbnail — 2-3 words max, ALL CAPS, no emojis, readable at small size],
  "pinnedComment": "A short engaging question to pin as first comment"
}

Title rules:
- Keep under 40 characters
- Hook immediately — first few words matter most
- Use trending formats and keywords for Shorts

Return only the JSON object. No markdown fences. No explanation.`;
  }

  return `Generate YouTube metadata for this video note:

---
${noteContent}
---

${settings.useWebSearch ? "Do 1-2 web searches to research top-performing titles and search terms for this topic, then generate metadata." : "Generate metadata based on your knowledge of YouTube SEO and this niche."}

Return a JSON object with exactly this shape:
{
  "searchTitles": [${titleCount} search-optimized titles — keyword-rich, designed to rank when people search for this topic],
  "clickTitles": [${titleCount} click-optimized titles — curiosity gaps, emotion, or surprising angles that make people click from Browse/Suggested. Use the video's unique details (crowds, weather, specific sights) to stand out],
  "descriptionEn": ${languageOutput !== "jp" ? (languageOutput === "en+jp" ? '"English section of a bilingual YouTube description. Start with a 1-2 sentence bilingual hook: English sentence first, then its Japanese equivalent on the next line. Then 2-3 short paragraphs (2-3 sentences each) separated by \\n\\n — what viewers will see, the atmosphere, context, with keywords woven naturally. Mobile-first: no walls of text. End with a --- divider line. 100-150 words for the English portion."' : '"SEO description in English. First 2 sentences: weave ALL major keywords (location, activity, year, format) into natural, readable prose. Then 2-3 short paragraphs separated by \\n\\n describing what viewers will see, the atmosphere, and context. Mobile-first: keep paragraphs short and scannable, no walls of text. NEVER use pipe-separated keyword lists. 150-250 words total."') : '""'},
  "descriptionJp": ${languageOutput !== "en" ? (languageOutput === "en+jp" ? '"Japanese section that continues after the English --- divider. Written natively for JP YouTube audience, NOT translated from the English above. 2-3 short paragraphs separated by \\n\\n. Include the location, atmosphere, and what to expect. Keywords woven naturally. 80-120 words."' : '"SEO description in Japanese — written natively for JP YouTube audience, not translated. First 2 sentences are the hook with keywords woven naturally. Use short paragraphs separated by \\n\\n for mobile readability. No pipe-separated keyword lists. 150-250 words."') : '""'},
  "hashtags": [exactly 3 hashtags with # prefix, highest-impact searchable terms],
  "tags": [${tagCount} tags — include BOTH English and Japanese for each location/term (e.g. "shibuya", "渋谷"). Lead with long-tail keywords. Include alternate romanizations. No # prefix],
  "thumbnailTexts": [3 short punchy text overlay suggestions for the thumbnail — 2-4 words max each, ALL CAPS, no emojis. Designed to be readable at small size in a bold clean font. Let the video footage speak visually.],
  "pinnedComment": "A conversational question or prompt to pin as the first comment, designed to drive engagement (e.g. 'Have you visited here during sakura season?')"
}

Search title rules:
- Keep under 65 characters
- Put the location/topic at the front
- Include markers like [4K] [Walking Tour] where relevant
- Mirror patterns from high-view competitor videos

Click title rules:
- Keep under 65 characters
- Lead with emotion, surprise, or a specific detail from the video
- Use curiosity gaps ("I didn't expect...", "Is it worth the crowds?")
- Feel personal and opinionated, not generic
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
    searchTitles?: string[];
    clickTitles?: string[];
    descriptionEn?: string;
    descriptionJp?: string;
    hashtags?: string[];
    tags?: string[];
    thumbnailTexts?: string[];
    pinnedComment?: string;
  };

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Could not parse Claude's response as JSON. Raw response:\n\n${rawText}`
    );
  }

  return {
    searchTitles: parsed.searchTitles ?? [],
    clickTitles: parsed.clickTitles ?? [],
    descriptionEn: parsed.descriptionEn ?? "",
    descriptionJp: parsed.descriptionJp ?? "",
    hashtags: parsed.hashtags ?? [],
    tags: parsed.tags ?? [],
    thumbnailTexts: parsed.thumbnailTexts ?? [],
    pinnedComment: parsed.pinnedComment ?? "",
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

  if (result.searchTitles.length > 0) {
    lines.push("### Search titles");
    result.searchTitles.forEach((title, i) => {
      lines.push(`${i + 1}. ${title}`);
    });
  }

  if (result.clickTitles.length > 0) {
    lines.push("", "### Click titles");
    result.clickTitles.forEach((title, i) => {
      lines.push(`${i + 1}. ${title}`);
    });
  }

  if (result.descriptionEn && result.descriptionJp) {
    lines.push("", "### Description");
    lines.push(result.descriptionEn);
    lines.push("", result.descriptionJp);
  } else if (result.descriptionEn) {
    lines.push("", "### Description");
    lines.push(result.descriptionEn);
  } else if (result.descriptionJp) {
    lines.push("", "### Description");
    lines.push(result.descriptionJp);
  }

  if (result.hashtags.length > 0) {
    lines.push("", "### Hashtags");
    lines.push(result.hashtags.join(" "));
  }

  if (result.tags.length > 0) {
    lines.push("", "### Tags");
    lines.push(result.tags.join(", "));
  }

  if (result.thumbnailTexts.length > 0) {
    lines.push("", "### Thumbnail text ideas");
    result.thumbnailTexts.forEach((text) => {
      lines.push(`- ${text}`);
    });
  }

  if (result.pinnedComment) {
    lines.push("", "### Pinned comment");
    lines.push(result.pinnedComment);
  }

  lines.push("", "---", "");

  return lines.join("\n");
}
