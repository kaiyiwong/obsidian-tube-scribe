import { App, PluginSettingTab, Setting } from "obsidian";
import type TubeScribePlugin from "./main";

export interface TubeScribeSettings {
  anthropicApiKey: string;
  channelContext: string;
  languageOutput: "en" | "en+jp" | "jp";
  titleCount: number;
  tagCount: number;
  includeTimestamps: boolean;
  includeLinks: boolean;
  useWebSearch: boolean;
  model: "sonnet" | "haiku";
}

export const DEFAULT_SETTINGS: TubeScribeSettings = {
  anthropicApiKey: "",
  channelContext: "",
  languageOutput: "en+jp",
  titleCount: 3,
  tagCount: 15,
  includeTimestamps: false,
  includeLinks: false,
  useWebSearch: false,
  model: "haiku",
};

export class TubeScribeSettingTab extends PluginSettingTab {
  plugin: TubeScribePlugin;

  constructor(app: App, plugin: TubeScribePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getCostEstimate(): string {
    const { model, useWebSearch } = this.plugin.settings;
    if (model === "haiku" && !useWebSearch) return "Estimated cost: ~$0.01/run (500 runs per $5)";
    if (model === "haiku" && useWebSearch) return "Estimated cost: ~$0.04/run (125 runs per $5)";
    if (model === "sonnet" && !useWebSearch) return "Estimated cost: ~$0.05/run (100 runs per $5)";
    return "Estimated cost: ~$0.15/run (33 runs per $5)";
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "TubeScribe Settings" });

    // API Key
    new Setting(containerEl)
      .setName("Anthropic API Key")
      .setDesc(
        "Your Anthropic API key. Stored locally on your device and only sent directly to api.anthropic.com."
      )
      .addText((text) => {
        text
          .setPlaceholder("sk-ant-...")
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
        text.inputEl.style.width = "100%";
      });

    // Channel Context
    new Setting(containerEl)
      .setName("Channel Context")
      .setDesc(
        "One or two sentences about your channel. Used to focus research and tailor generated metadata."
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("e.g. Silent walking videos across Tokyo neighborhoods...")
          .setValue(this.plugin.settings.channelContext)
          .onChange(async (value) => {
            this.plugin.settings.channelContext = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 3;
        text.inputEl.style.width = "100%";
      });

    // Language Output
    new Setting(containerEl)
      .setName("Language Output")
      .setDesc("Which languages to generate descriptions in.")
      .addDropdown((drop) => {
        drop
          .addOption("en", "English only")
          .addOption("en+jp", "English + Japanese")
          .addOption("jp", "Japanese only")
          .setValue(this.plugin.settings.languageOutput)
          .onChange(async (value) => {
            this.plugin.settings.languageOutput = value as "en" | "en+jp" | "jp";
            await this.plugin.saveSettings();
          });
      });

    // Title Count
    new Setting(containerEl)
      .setName("Number of Titles")
      .setDesc("How many title options to generate (1–5).")
      .addSlider((slider) => {
        slider
          .setLimits(1, 5, 1)
          .setValue(this.plugin.settings.titleCount)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.titleCount = value;
            await this.plugin.saveSettings();
          });
      });

    // Tag Count
    new Setting(containerEl)
      .setName("Number of Tags")
      .setDesc("How many tags to generate (5–30).")
      .addSlider((slider) => {
        slider
          .setLimits(5, 30, 1)
          .setValue(this.plugin.settings.tagCount)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.tagCount = value;
            await this.plugin.saveSettings();
          });
      });

    // Cost & Performance section
    containerEl.createEl("h3", { text: "Cost & Performance" });

    const costEstimate = this.getCostEstimate();
    const costEl = containerEl.createEl("p", {
      text: costEstimate,
      cls: "setting-item-description",
    });
    costEl.style.marginBottom = "12px";
    costEl.style.fontWeight = "bold";

    // Model
    new Setting(containerEl)
      .setName("Model")
      .setDesc(
        "Haiku: fast, great for everyday use (~$0.01/run). Sonnet: stronger Japanese writing and more creative titles (~$0.05/run). Upgrade to Sonnet when you need polished JP descriptions."
      )
      .addDropdown((drop) => {
        drop
          .addOption("haiku", "Claude Haiku (default)")
          .addOption("sonnet", "Claude Sonnet (premium)")
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value as "sonnet" | "haiku";
            await this.plugin.saveSettings();
            costEl.setText(this.getCostEstimate());
          });
      });

    // Web Search
    new Setting(containerEl)
      .setName("Web Search")
      .setDesc(
        "Searches for current competitor titles and trending keywords. Best for events, seasonal content, or uncommon topics. Adds ~$0.03-0.10/run."
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.useWebSearch)
          .onChange(async (value) => {
            this.plugin.settings.useWebSearch = value;
            await this.plugin.saveSettings();
            costEl.setText(this.getCostEstimate());
          });
      });

    // Include Timestamps
    new Setting(containerEl)
      .setName("Include Timestamp Placeholders")
      .setDesc(
        "Add suggested chapter timestamps in the description (you fill in the actual times)."
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.includeTimestamps)
          .onChange(async (value) => {
            this.plugin.settings.includeTimestamps = value;
            await this.plugin.saveSettings();
          });
      });

    // Include Links
    new Setting(containerEl)
      .setName("Include Links Section")
      .setDesc(
        "Add a links section in the description (subscribe, social, related videos)."
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.includeLinks)
          .onChange(async (value) => {
            this.plugin.settings.includeLinks = value;
            await this.plugin.saveSettings();
          });
      });

    // Footer note
    containerEl.createEl("p", {
      text: "Your API key is stored in Obsidian's local config and never leaves your device except in direct requests to the Anthropic API.",
      cls: "setting-item-description",
    });
  }
}
