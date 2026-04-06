import { Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, TubeScribeSettingTab } from "./settings";
import type { TubeScribeSettings } from "./settings";
import { runPipeline, formatMetadataBlock } from "./pipeline";
import { ConfirmModal, ProgressModal, ResultModal } from "./modal";

export default class TubeScribePlugin extends Plugin {
  settings: TubeScribeSettings;

  async onload() {
    await this.loadSettings();

    // Add settings tab
    this.addSettingTab(new TubeScribeSettingTab(this.app, this));

    // Register main command
    this.addCommand({
      id: "generate-youtube-metadata",
      name: "Generate YouTube metadata",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (checking) return true;

        void this.confirmAndRun(file);
        return true;
      },
    });

    // Ribbon icon
    this.addRibbonIcon("youtube", "TubeScribe: generate metadata", () => {
      const file = this.app.workspace.getActiveFile();
      if (!file) {
        new Notice("TubeScribe: no active note open.");
        return;
      }
      void this.confirmAndRun(file);
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async confirmAndRun(file: TFile) {
    if (!this.settings.anthropicApiKey) {
      new Notice(
        "TubeScribe: please set your Anthropic API key in settings first.",
        5000
      );
      return;
    }

    const noteContent = await this.app.vault.read(file);
    if (!noteContent.trim()) {
      new Notice(
        "TubeScribe: note is empty. Add some content about your video first.",
        5000
      );
      return;
    }

    new ConfirmModal(this.app, this.settings, (options) => {
      const runSettings = { ...this.settings, ...options };
      void this.runMetadataPipeline(file, runSettings);
    }).open();
  }

  private async runMetadataPipeline(file: TFile, runSettings?: TubeScribeSettings) {
    const settings = runSettings ?? this.settings;
    const progressModal = new ProgressModal(this.app);
    progressModal.open();

    try {
      const noteContent = await this.app.vault.read(file);

      const result = await runPipeline(
        noteContent,
        settings,
        (msg: string) => {
          progressModal.setMessage(msg);
        }
      );

      progressModal.close();

      // Show result modal with option to insert
      const resultModal = new ResultModal(this.app, result, async () => {
        await this.appendMetadataToNote(file, result);
      });
      resultModal.open();
    } catch (err) {
      progressModal.close();
      const message =
        err instanceof Error ? err.message : "Unknown error occurred.";
      new Notice(`TubeScribe: ${message}`, 8000);
      console.error("TubeScribe pipeline error:", err);
    }
  }

  private async appendMetadataToNote(
    file: TFile,
    result: import("./pipeline").PipelineResult
  ) {
    try {
      const currentContent = await this.app.vault.read(file);
      const metadataBlock = formatMetadataBlock(result);
      await this.app.vault.modify(file, currentContent + metadataBlock);
      new Notice("TubeScribe: metadata appended to note.");
    } catch (err) {
      new Notice("TubeScribe: failed to write to note.");
      console.error("TubeScribe write error:", err);
    }
  }
}
