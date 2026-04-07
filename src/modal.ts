import { App, Modal, Setting } from "obsidian";
import type { PipelineResult } from "./pipeline";
import type { TubeScribeSettings } from "./settings";
import { getCostColorClass } from "./settings";

interface RunOptions {
  model: "sonnet" | "haiku";
  useWebSearch: boolean;
  videoType: "video" | "short";
}

function getCostValue(model: string, useWebSearch: boolean): string {
  if (model === "haiku" && !useWebSearch) return "~$0.01";
  if (model === "haiku" && useWebSearch) return "~$0.06";
  if (model === "sonnet" && !useWebSearch) return "~$0.05";
  return "~$0.15";
}

export class ConfirmModal extends Modal {
  private onConfirm: (options: RunOptions) => void;
  private options: RunOptions;

  constructor(app: App, settings: TubeScribeSettings, onConfirm: (options: RunOptions) => void) {
    super(app);
    this.onConfirm = onConfirm;
    this.options = {
      model: settings.model,
      useWebSearch: settings.useWebSearch,
      videoType: "video",
    };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl).setName("Generate metadata?").setHeading();

    // Cost display with colored value
    const costLine = contentEl.createEl("p", {
      cls: "tube-scribe-cost-estimate",
    });

    const updateCostDisplay = () => {
      costLine.empty();
      const { model, useWebSearch } = this.options;
      const modelLabel = model === "haiku" ? "Haiku" : "Sonnet";
      const searchLabel = useWebSearch ? " + web search" : "";
      costLine.appendText(`${modelLabel}${searchLabel} — estimated cost: `);
      costLine.createEl("span", {
        text: getCostValue(model, useWebSearch),
        cls: ["tube-scribe-cost-value", getCostColorClass(model, useWebSearch)],
      });
    };

    updateCostDisplay();

    // Video type
    new Setting(contentEl)
      .setName("Format")
      .addDropdown((drop) => {
        drop
          .addOption("video", "Video")
          .addOption("short", "Short")
          .setValue(this.options.videoType)
          .onChange((value) => {
            this.options.videoType = value as "video" | "short";
          });
      });

    // Model toggle
    new Setting(contentEl)
      .setName("Model")
      .addDropdown((drop) => {
        drop
          .addOption("haiku", "Haiku")
          .addOption("sonnet", "Sonnet")
          .setValue(this.options.model)
          .onChange((value) => {
            this.options.model = value as "sonnet" | "haiku";
            updateCostDisplay();
          });
      });

    // Web search toggle
    new Setting(contentEl)
      .setName("Web search")
      .addToggle((toggle) => {
        toggle
          .setValue(this.options.useWebSearch)
          .onChange((value) => {
            this.options.useWebSearch = value;
            updateCostDisplay();
          });
      });

    new Setting(contentEl)
      .addButton((btn) => {
        btn
          .setButtonText("Generate")
          .setCta()
          .onClick(() => {
            this.close();
            this.onConfirm(this.options);
          });
      })
      .addButton((btn) => {
        btn.setButtonText("Cancel").onClick(() => {
          this.close();
        });
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class ProgressModal extends Modal {
  private messageEl: HTMLElement;

  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl).setName("Generating...").setHeading();

    const statusEl = contentEl.createEl("div", {
      cls: "tube-scribe-status",
    });

    statusEl.createEl("span", { cls: "tube-scribe-spinner" });

    this.messageEl = statusEl.createEl("span", {
      text: "Starting pipeline...",
    });
  }

  setMessage(msg: string) {
    if (this.messageEl) {
      this.messageEl.setText(msg);
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class ResultModal extends Modal {
  private result: PipelineResult;
  private onInsert: () => Promise<void>;

  constructor(app: App, result: PipelineResult, onInsert: () => Promise<void>) {
    super(app);
    this.result = result;
    this.onInsert = onInsert;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("tube-scribe-result");

    new Setting(contentEl).setName("Generated metadata").setHeading();

    // Titles
    contentEl.createEl("h3", { text: "Titles" });
    const titleList = contentEl.createEl("ol");
    this.result.titles.forEach((title) => {
      titleList.createEl("li", { text: title });
    });

    // EN Description
    if (this.result.descriptionEn) {
      contentEl.createEl("h3", { text: "Description (en)" });
      contentEl.createEl("p", {
        text: this.result.descriptionEn,
        cls: "tube-scribe-description",
      });
    }

    // JP Description
    if (this.result.descriptionJp) {
      contentEl.createEl("h3", { text: "Description (jp)" });
      contentEl.createEl("p", {
        text: this.result.descriptionJp,
        cls: "tube-scribe-description",
      });
    }

    // Hashtags
    if (this.result.hashtags.length > 0) {
      contentEl.createEl("h3", { text: "Hashtags" });
      contentEl.createEl("p", {
        text: this.result.hashtags.join(" "),
        cls: "tube-scribe-tags",
      });
    }

    // Tags
    if (this.result.tags.length > 0) {
      contentEl.createEl("h3", { text: "Tags" });
      contentEl.createEl("p", {
        text: this.result.tags.join(", "),
        cls: "tube-scribe-tags",
      });
    }

    // Buttons
    const buttonRow = contentEl.createEl("div", {
      cls: "tube-scribe-buttons",
    });

    new Setting(buttonRow)
      .addButton((btn) => {
        btn
          .setButtonText("Append to note")
          .setCta()
          .onClick(async () => {
            await this.onInsert();
            this.close();
          });
      })
      .addButton((btn) => {
        btn.setButtonText("Close").onClick(() => {
          this.close();
        });
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}
