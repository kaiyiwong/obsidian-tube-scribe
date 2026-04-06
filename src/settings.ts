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

export function getCostColorClass(model: string, useWebSearch: boolean): string {
  if (model === "haiku" && !useWebSearch) return "tube-scribe-cost-green";
  if (model === "haiku" && useWebSearch) return "tube-scribe-cost-yellow";
  if (model === "sonnet" && !useWebSearch) return "tube-scribe-cost-yellow";
  return "tube-scribe-cost-red";
}

export class TubeScribeSettingTab extends PluginSettingTab {
  plugin: TubeScribePlugin;

  constructor(app: App, plugin: TubeScribePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getCostDetails(): { value: string; runsPerFive: string } {
    const { model, useWebSearch } = this.plugin.settings;
    if (model === "haiku" && !useWebSearch) return { value: "~$0.01", runsPerFive: "500" };
    if (model === "haiku" && useWebSearch) return { value: "~$0.06", runsPerFive: "80" };
    if (model === "sonnet" && !useWebSearch) return { value: "~$0.05", runsPerFive: "100" };
    return { value: "~$0.15", runsPerFive: "33" };
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("General").setHeading();

    // API Key
    new Setting(containerEl)
      .setName("API key")
      .setDesc(
        "Stored locally on your device and only sent directly to api.anthropic.com."
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
        text.inputEl.addClass("tube-scribe-input-wide");
      });

    // Channel Context
    new Setting(containerEl)
      .setName("Channel context")
      .setDesc(
        "One or two sentences about your channel, used to focus research and tailor generated metadata."
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("e.g. silent walking videos across Tokyo neighborhoods...")
          .setValue(this.plugin.settings.channelContext)
          .onChange(async (value) => {
            this.plugin.settings.channelContext = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 3;
        text.inputEl.addClass("tube-scribe-input-wide");
      });

    // Language Output
    new Setting(containerEl)
      .setName("Language output")
      .setDesc("Which languages to generate descriptions in")
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
      .setName("Number of titles")
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
      .setName("Number of tags")
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
    new Setting(containerEl).setName("Cost & performance").setHeading();

    const costEl = containerEl.createEl("p", {
      cls: ["setting-item-description", "tube-scribe-cost-estimate"],
    });

    const updateCostDisplay = () => {
      const { model, useWebSearch } = this.plugin.settings;
      const { value, runsPerFive } = this.getCostDetails();
      costEl.empty();
      costEl.appendText("Estimated cost: ");
      costEl.createEl("span", {
        text: `${value}/run`,
        cls: ["tube-scribe-cost-value", getCostColorClass(model, useWebSearch)],
      });
      costEl.appendText(` (${runsPerFive} runs per $5)`);
    };

    updateCostDisplay();

    // Model
    new Setting(containerEl)
      .setName("Model")
      .setDesc(
        "Haiku is fast, great for everyday use (~$0.01/run). Sonnet has stronger Japanese writing and more creative titles (~$0.05/run)."
      )
      .addDropdown((drop) => {
        drop
          .addOption("haiku", "Haiku (default)")
          .addOption("sonnet", "Sonnet (premium)")
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value as "sonnet" | "haiku";
            await this.plugin.saveSettings();
            updateCostDisplay();
          });
      });

    // Web Search
    new Setting(containerEl)
      .setName("Web search")
      .setDesc(
        "Searches for current competitor titles and trending keywords, best for events, seasonal content, or uncommon topics. Adds ~$0.05-0.10/run."
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.useWebSearch)
          .onChange(async (value) => {
            this.plugin.settings.useWebSearch = value;
            await this.plugin.saveSettings();
            updateCostDisplay();
          });
      });

    // Include Timestamps
    new Setting(containerEl)
      .setName("Include timestamp placeholders")
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
      .setName("Include links section")
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
      text: "Your API key is stored locally and never leaves your device except in direct requests to api.anthropic.com.",
      cls: "setting-item-description",
    });
  }
}
