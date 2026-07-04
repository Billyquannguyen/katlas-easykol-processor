import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir =
  "/Users/anhquannguyen/Documents/Katlas productivity/easykol-processor/outputs/easykol-processor-database";
const outputPath = path.join(outputDir, "EasyKOL Processor Database.xlsx");
const previewPath = path.join(outputDir, "EasyKOL Processor Database preview.png");
const now = new Date().toISOString();

const defaultTemplateColumns = [
  {
    id: "column-creator",
    label: "Creator",
    blockType: "field",
    fieldKey: "Nickname",
  },
  {
    id: "column-username",
    label: "Username",
    blockType: "field",
    fieldKey: "@Username",
  },
  {
    id: "column-followers",
    label: "Followers",
    blockType: "field",
    fieldKey: "Followers",
  },
  {
    id: "column-avg-views",
    label: "Avg Views",
    blockType: "field",
    fieldKey: "Avg. Views",
  },
  {
    id: "column-contacts",
    label: "Contacts",
    blockType: "contacts",
  },
  {
    id: "column-coordinator",
    label: "Coordinator",
    blockType: "custom",
    customValue: "",
  },
];

const sourcingHeaders = [
  "id",
  "campaignId",
  "campaignName",
  "templateName",
  "columnsJson",
  "isActive",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
];

const appSettingsHeaders = ["settingKey", "settingValue", "updatedAt"];

const workbook = Workbook.create();

const sourcing = workbook.worksheets.add("SourcingTemplates");
sourcing.showGridLines = false;
sourcing.getRange("A1:J2").values = [
  sourcingHeaders,
  [
    "sourcing-template-default",
    "easykol-processor",
    "EasyKOL Processor",
    "Default Template",
    JSON.stringify(defaultTemplateColumns),
    "TRUE",
    now,
    now,
    "Codex",
    "Codex",
  ],
];
sourcing.freezePanes.freezeRows(1);
sourcing.getRange("A1:J1").format.font = { bold: true };
sourcing.getRange("A1:J2").format.borders = { preset: "outside", style: "thin", color: "#D1D5DB" };
sourcing.getRange("A:A").format.columnWidth = 24;
sourcing.getRange("B:B").format.columnWidth = 22;
sourcing.getRange("C:D").format.columnWidth = 24;
sourcing.getRange("E:E").format.columnWidth = 64;
sourcing.getRange("F:J").format.columnWidth = 20;
sourcing.getRange("E:E").format.wrapText = true;
sourcing.getRange("G:H").setNumberFormat("yyyy-mm-dd hh:mm");

const settings = workbook.worksheets.add("AppSettings");
settings.showGridLines = false;
settings.getRange("A1:C2").values = [
  appSettingsHeaders,
  ["sourcing.activeTemplate.easykol-processor", "sourcing-template-default", now],
];
settings.freezePanes.freezeRows(1);
settings.getRange("A1:C1").format.font = { bold: true };
settings.getRange("A1:C2").format.borders = { preset: "outside", style: "thin", color: "#D1D5DB" };
settings.getRange("A:A").format.columnWidth = 42;
settings.getRange("B:B").format.columnWidth = 30;
settings.getRange("C:C").format.columnWidth = 20;
settings.getRange("C:C").setNumberFormat("yyyy-mm-dd hh:mm");

const sheetCheck = await workbook.inspect({
  kind: "sheet,table",
  maxChars: 6000,
  tableMaxRows: 4,
  tableMaxCols: 12,
});
console.log(sheetCheck.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "SourcingTemplates",
  range: "A1:J2",
  autoCrop: "all",
  scale: 2,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(JSON.stringify({ outputPath, previewPath }, null, 2));
