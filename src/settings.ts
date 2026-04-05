import { App, PluginSettingTab, Setting } from "obsidian";
import type TubeScribePlugin from "./main";

export interface TubeScribeSettings {
  anthropicApiKey: string;
  channelContext: string;
  languageOutput: "en" | "en+jp" | "jp";
  titleCount: number;
  tagCount: number;
}

export const DEFAULT_SETTINGS: TubeScribeSettings = {
  anthropicApiKey: "",
  channelContext:
    "Silent walking videos across Tokyo neighborhoods, events, and daily life in Japan.",
  languageOutput: "en+jp",
  titleCount: 3,
  tagCount: 15,
};

export class TubeScribeSettingTab extends PluginSettingTab {
  plugin: TubeScribePlugin;

  constructor(app: App, plugin: TubeScribePlugin) {
    super(app, plugin);
    this.plugin = plugin;
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

    // Footer note
    containerEl.createEl("p", {
      text: "Your API key is stored in Obsidian's local config and never leaves your device except in direct requests to the Anthropic API.",
      cls: "setting-item-description",
    });
  }
}
