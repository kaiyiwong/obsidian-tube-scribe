import { App, Modal, Setting } from "obsidian";
import type { PipelineResult } from "./pipeline";

export class ProgressModal extends Modal {
  private messageEl: HTMLElement;
  private statusEl: HTMLElement;

  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "TubeScribe" });

    this.statusEl = contentEl.createEl("div", {
      cls: "tube-scribe-status",
    });
    this.statusEl.style.display = "flex";
    this.statusEl.style.alignItems = "center";
    this.statusEl.style.gap = "10px";
    this.statusEl.style.marginTop = "10px";

    const spinner = this.statusEl.createEl("span");
    spinner.style.display = "inline-block";
    spinner.style.width = "16px";
    spinner.style.height = "16px";
    spinner.style.border = "2px solid var(--interactive-accent)";
    spinner.style.borderTopColor = "transparent";
    spinner.style.borderRadius = "50%";
    spinner.style.animation = "tube-scribe-spin 0.8s linear infinite";

    // Inject keyframe animation
    const style = document.createElement("style");
    style.textContent = `@keyframes tube-scribe-spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

    this.messageEl = this.statusEl.createEl("span", {
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
    contentEl.style.maxWidth = "600px";

    contentEl.createEl("h2", { text: "📺 Generated Metadata" });

    // Titles
    contentEl.createEl("h3", { text: "Titles" });
    const titleList = contentEl.createEl("ol");
    this.result.titles.forEach((title) => {
      titleList.createEl("li", { text: title });
    });

    // EN Description
    if (this.result.descriptionEn) {
      contentEl.createEl("h3", { text: "Description (EN)" });
      const descEl = contentEl.createEl("p", {
        text: this.result.descriptionEn,
      });
      descEl.style.fontSize = "0.85em";
      descEl.style.opacity = "0.8";
      descEl.style.whiteSpace = "pre-wrap";
    }

    // JP Description
    if (this.result.descriptionJp) {
      contentEl.createEl("h3", { text: "Description (JP)" });
      const descJpEl = contentEl.createEl("p", {
        text: this.result.descriptionJp,
      });
      descJpEl.style.fontSize = "0.85em";
      descJpEl.style.opacity = "0.8";
      descJpEl.style.whiteSpace = "pre-wrap";
    }

    // Tags
    if (this.result.tags.length > 0) {
      contentEl.createEl("h3", { text: "Tags" });
      contentEl.createEl("p", { text: this.result.tags.join(", ") }).style.fontSize = "0.85em";
    }

    // Buttons
    const buttonRow = contentEl.createEl("div");
    buttonRow.style.display = "flex";
    buttonRow.style.gap = "10px";
    buttonRow.style.marginTop = "20px";

    new Setting(buttonRow)
      .addButton((btn) => {
        btn
          .setButtonText("Append to Note")
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
