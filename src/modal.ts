import { App, Modal, Setting } from "obsidian";
import type { PipelineResult } from "./pipeline";

export class ProgressModal extends Modal {
  private messageEl: HTMLElement;

  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl).setName("TubeScribe").setHeading();

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
  private onInsert: () => void;

  constructor(app: App, result: PipelineResult, onInsert: () => void) {
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
      contentEl.createEl("h3", { text: "Description (EN)" });
      contentEl.createEl("p", {
        text: this.result.descriptionEn,
        cls: "tube-scribe-description",
      });
    }

    // JP Description
    if (this.result.descriptionJp) {
      contentEl.createEl("h3", { text: "Description (JP)" });
      contentEl.createEl("p", {
        text: this.result.descriptionJp,
        cls: "tube-scribe-description",
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
          .onClick(() => {
            this.onInsert();
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
