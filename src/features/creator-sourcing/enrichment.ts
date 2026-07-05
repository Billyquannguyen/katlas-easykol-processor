import { getCell } from "./filters";
import type {
  ColumnMap,
  ContactDiscovery,
  ContactEnrichmentReport,
  ContactField,
  ContactInfo,
  CreatorEnrichmentResult,
  CreatorRow,
  PreviewRow,
  TemplateColumn,
  UploadedCreator,
} from "./types";

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const urlRegex = /https?:\/\/[^\s"'<>),\]]+/gi;
const phoneRegex = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const contactFields: ContactField[] = [
  "email",
  "line",
  "whatsapp",
  "phone",
  "instagram",
  "tiktok",
  "youtube",
  "website",
  "other",
];

export type LocalExtractorInput = {
  data: CreatorRow;
  columnMap: ColumnMap;
};

export type ExternalDiscoveryInput = {
  creatorId: string;
  data: CreatorRow;
  columnMap: ColumnMap;
  knownUrls: string[];
  localDiscoveries: ContactDiscovery[];
};

export type ExternalDiscoveryResult = {
  discoveries: ContactDiscovery[];
  status: string;
};

export interface ExternalDiscoveryProvider {
  name: string;
  discover(input: ExternalDiscoveryInput): Promise<ExternalDiscoveryResult>;
}

export class LocalExtractor {
  name = "LocalExtractor";

  extract({ data, columnMap }: LocalExtractorInput): ContactDiscovery[] {
    const emailColumn = getCell(data, columnMap, "Email");
    const description = getCell(data, columnMap, "Description");
    const url = getCell(data, columnMap, "URL");
    const bioText = [description, url].filter(Boolean).join(" ");
    const discoveries: ContactDiscovery[] = [];

    const emailFromColumn = firstMatch(emailColumn, emailRegex);
    const emailFromDescription = firstMatch(description, emailRegex);
    if (emailFromColumn) {
      discoveries.push(
        createDiscovery("email", emailFromColumn, "Email Column", "Regex", 96, "Email Column"),
      );
    } else if (emailFromDescription) {
      discoveries.push(createDiscovery("email", emailFromDescription, "Description", "Regex", 86));
    }

    const line = extractLine(bioText);
    if (line) {
      discoveries.push(createDiscovery("line", line, "Description", "Regex", 76));
    }

    const whatsappFromDescription = extractWhatsapp(description);
    const whatsappFromUrl = whatsappFromDescription ? undefined : extractWhatsapp(url);
    if (whatsappFromDescription) {
      discoveries.push(
        createDiscovery("whatsapp", whatsappFromDescription, "Description", "Regex", 76),
      );
    } else if (whatsappFromUrl) {
      discoveries.push(createDiscovery("whatsapp", whatsappFromUrl, "URL", "URL Match", 76, url));
    }

    const instagramFromDescription = extractInstagram(description);
    const instagramFromUrl = instagramFromDescription ? undefined : extractInstagram(url);
    if (instagramFromDescription) {
      discoveries.push(
        createDiscovery("instagram", instagramFromDescription, "Description", "Regex", 68),
      );
    } else if (instagramFromUrl) {
      discoveries.push(createDiscovery("instagram", instagramFromUrl, "URL", "URL Match", 68, url));
    }

    const tiktok = extractTiktok(bioText);
    if (tiktok) {
      discoveries.push(createDiscovery("tiktok", tiktok, "Description", "Regex", 64));
    }

    const youtube = extractYoutube(bioText);
    if (youtube) {
      discoveries.push(createDiscovery("youtube", youtube, "Description", "Regex", 64));
    }

    const phone = extractPhone(bioText);
    if (phone && phone !== whatsappFromDescription && phone !== whatsappFromUrl) {
      discoveries.push(createDiscovery("phone", phone, "Description", "Regex", 58));
    }

    const website = extractWebsite(bioText);
    if (website) {
      discoveries.push(createDiscovery("website", website, "Description", "URL Match", 54, website));
    }

    return dedupeDiscoveries(discoveries);
  }
}

export class NoExternalDiscoveryProvider implements ExternalDiscoveryProvider {
  name = "ExternalDiscoveryProvider";

  async discover(): Promise<ExternalDiscoveryResult> {
    return {
      discoveries: [],
      status: "No external discovery configured",
    };
  }
}

const localExtractor = new LocalExtractor();
const noExternalDiscoveryProvider = new NoExternalDiscoveryProvider();

export async function runEnrichmentPipeline({
  creators,
  columnMap,
  externalProvider = noExternalDiscoveryProvider,
}: {
  creators: UploadedCreator[];
  columnMap: ColumnMap;
  externalProvider?: ExternalDiscoveryProvider;
}): Promise<{
  results: CreatorEnrichmentResult[];
  report: ContactEnrichmentReport;
  externalDiscoveryStatus: string;
}> {
  const results: CreatorEnrichmentResult[] = [];
  let externalDiscoveryStatus = "No external discovery configured";

  for (const creator of creators) {
    const localDiscoveries = localExtractor.extract({
      data: creator.data,
      columnMap,
    });
    const externalResult = await externalProvider.discover({
      creatorId: creator.id,
      data: creator.data,
      columnMap,
      knownUrls: getUrlsFromRow(creator.data, columnMap),
      localDiscoveries,
    });
    externalDiscoveryStatus = externalResult.status;

    results.push({
      creatorId: creator.id,
      contactInfo: mergeContactDiscoveries(
        [...localDiscoveries, ...externalResult.discoveries],
        externalResult.status,
      ),
    });
  }

  return {
    results,
    report: buildContactEnrichmentReport(results),
    externalDiscoveryStatus,
  };
}

export function createEmptyContactInfo(): ContactInfo {
  return {
    confidence: 0,
    discoveryMethod: "No contact enrichment run",
    discoveries: [],
    externalDiscoveryStatus: "Local bio scan not run",
  };
}

export function extractContactInfo(data: CreatorRow, columnMap: ColumnMap): ContactInfo {
  return mergeContactDiscoveries(
    localExtractor.extract({ data, columnMap }),
    "Local bio scan only. No AI or external discovery used.",
  );
}

export function hasContactInfo(contactInfo: ContactInfo): boolean {
  return contactFields.some((field) => Boolean(contactInfo[field]));
}

export function formatContacts(contactInfo: ContactInfo): string {
  const lines: string[] = [];
  if (contactInfo.email) {
    lines.push(`Email: ${contactInfo.email}`);
  }
  if (contactInfo.line) {
    lines.push(`Line: ${formatHandle(contactInfo.line)}`);
  }
  if (contactInfo.whatsapp) {
    lines.push(`Whatsapp: ${contactInfo.whatsapp}`);
  }
  if (contactInfo.phone) {
    lines.push(`Phone: ${contactInfo.phone}`);
  }
  if (contactInfo.instagram) {
    lines.push(`Instagram: ${contactInfo.instagram}`);
  }
  if (contactInfo.tiktok) {
    lines.push(`TikTok: ${contactInfo.tiktok}`);
  }
  if (contactInfo.youtube) {
    lines.push(`YouTube: ${contactInfo.youtube}`);
  }
  if (contactInfo.website) {
    lines.push(`Website: ${contactInfo.website}`);
  }
  if (contactInfo.other) {
    lines.push(`Other: ${contactInfo.other}`);
  }
  return lines.join("\n");
}

export function buildPreviewRow({
  id,
  data,
  columnMap,
  template,
  contactInfo,
}: {
  id: string;
  data: CreatorRow;
  columnMap: ColumnMap;
  template: TemplateColumn[];
  contactInfo?: ContactInfo;
}): PreviewRow {
  const contactsCell = getCell(data, columnMap, "Contacts");
  const resolvedContactInfo =
    contactInfo ??
    (contactsCell ? createContactInfoFromContactsCell(contactsCell) : createEmptyContactInfo());
  const values = template.map((column) => {
    if (column.blockType === "blank") return "";
    if (column.blockType === "custom") return column.customValue ?? "";
    if (column.blockType === "contacts") return contactsCell || formatContacts(resolvedContactInfo);
    if (!column.fieldKey) return "";
    return getCell(data, columnMap, column.fieldKey);
  });

  return { id, values, contactInfo: resolvedContactInfo };
}

function createContactInfoFromContactsCell(value: string): ContactInfo {
  return {
    other: value,
    confidence: 100,
    discoveryMethod: "Existing Contacts column",
    discoveries: [],
    externalDiscoveryStatus: "Existing Contacts column",
  };
}

function mergeContactDiscoveries(
  discoveries: ContactDiscovery[],
  externalDiscoveryStatus: string,
): ContactInfo {
  const uniqueDiscoveries = dedupeDiscoveries(discoveries);
  const bestByField = contactFields.reduce<Partial<Record<ContactField, ContactDiscovery>>>(
    (best, field) => {
      best[field] = pickBestDiscovery(uniqueDiscoveries, field);
      return best;
    },
    {},
  );
  const strongestDiscovery = [...uniqueDiscoveries].sort(
    (first, second) => second.confidence - first.confidence,
  )[0];

  return {
    email: bestByField.email?.value,
    line: bestByField.line?.value,
    whatsapp: bestByField.whatsapp?.value,
    phone: bestByField.phone?.value,
    instagram: bestByField.instagram?.value,
    tiktok: bestByField.tiktok?.value,
    youtube: bestByField.youtube?.value,
    website: bestByField.website?.value,
    other: bestByField.other?.value,
    sourceUrl: strongestDiscovery?.sourceUrl,
    confidence: strongestDiscovery?.confidence ?? 0,
    discoveryMethod: strongestDiscovery
      ? `${strongestDiscovery.provider}: ${strongestDiscovery.source} ${strongestDiscovery.discoveryMethod}`
      : "No contact found",
    discoveries: uniqueDiscoveries,
    externalDiscoveryStatus,
  };
}

export function buildContactEnrichmentReport(
  results: CreatorEnrichmentResult[],
): ContactEnrichmentReport {
  const creatorsWithContact = results.filter((result) => hasContactInfo(result.contactInfo)).length;

  return {
    creatorsProcessed: results.length,
    emailFound: countField(results, "email"),
    lineFound: countField(results, "line"),
    whatsappFound: countField(results, "whatsapp"),
    instagramFound: countField(results, "instagram"),
    creatorsWithContact,
    creatorsWithoutContact: results.length - creatorsWithContact,
  };
}

function countField(results: CreatorEnrichmentResult[], field: ContactField): number {
  return results.filter((result) => Boolean(result.contactInfo[field])).length;
}

function pickBestDiscovery(
  discoveries: ContactDiscovery[],
  field: ContactField,
): ContactDiscovery | undefined {
  return discoveries
    .filter((discovery) => discovery.field === field)
    .sort((first, second) => second.confidence - first.confidence)[0];
}

function createDiscovery(
  field: ContactField,
  value: string,
  source: ContactDiscovery["source"],
  discoveryMethod: ContactDiscovery["discoveryMethod"],
  confidence: number,
  sourceUrl?: string,
): ContactDiscovery {
  return {
    field,
    value,
    source,
    discoveryMethod,
    provider: "LocalExtractor",
    confidence,
    sourceUrl,
  };
}

function dedupeDiscoveries(discoveries: ContactDiscovery[]): ContactDiscovery[] {
  const seen = new Set<string>();
  return discoveries.filter((discovery) => {
    const key = `${discovery.field}:${discovery.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractLine(text: string): string | undefined {
  const match = text.match(/(?:line|line id|lineid|ไลน์)[:\s@-]+([a-zA-Z0-9_.-]{3,40})/i);
  return match?.[1] ? formatHandle(match[1]) : undefined;
}

function extractWhatsapp(text: string): string | undefined {
  const waLink = text.match(/(?:wa\.me\/|whatsapp[^\d+]{0,16})(\+?\d[\d\s().-]{7,}\d)/i)?.[1];
  if (waLink) return normalizePhone(waLink);
  if (!/whatsapp|wa\.me/i.test(text)) return undefined;
  const phone = text.match(phoneRegex)?.[0];
  return phone ? normalizePhone(phone) : undefined;
}

function extractInstagram(text: string): string | undefined {
  const url = firstMatch(text, /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?/gi);
  if (url) return cleanUrl(url);
  const handle = text.match(/(?:instagram|ig|insta)[:\s@-]+([a-zA-Z0-9_.]{2,30})/i)?.[1];
  const cleanHandle = handle ? cleanSocialHandle(handle) : "";
  return cleanHandle ? `https://instagram.com/${cleanHandle}` : undefined;
}

function extractTiktok(text: string): string | undefined {
  const url = firstMatch(text, /https?:\/\/(?:www\.)?tiktok\.com\/@?[a-zA-Z0-9_.-]+\/?/gi);
  if (url) return cleanUrl(url);
  const handle = text.match(/(?:tiktok|tik tok)[:\s@-]+([a-zA-Z0-9_.-]{2,30})/i)?.[1];
  const cleanHandle = handle ? cleanSocialHandle(handle) : "";
  return cleanHandle ? "https://tiktok.com/@" + cleanHandle : undefined;
}

function extractYoutube(text: string): string | undefined {
  const url = firstMatch(
    text,
    /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:@|channel\/|c\/|user\/)?[a-zA-Z0-9_.@-]+|youtu\.be\/[a-zA-Z0-9_-]+)\/?/gi,
  );
  return url ? cleanUrl(url) : undefined;
}

function extractPhone(text: string): string | undefined {
  const match = firstMatch(text, phoneRegex);
  return match ? normalizePhone(match) : undefined;
}

function extractWebsite(text: string): string | undefined {
  const urls = text.match(urlRegex)?.map(cleanUrl) ?? [];
  return urls.find((url) => !isSocialOrMessagingUrl(url));
}

function isSocialOrMessagingUrl(url: string): boolean {
  return /(?:instagram\.com|tiktok\.com|youtube\.com|youtu\.be|wa\.me|whatsapp)/i.test(url);
}
function firstMatch(text: string, regex: RegExp): string | undefined {
  return text.match(regex)?.[0]?.trim();
}

function cleanUrl(url: string): string {
  return url.replace(/[.,;]+$/, "");
}

function formatHandle(value: string): string {
  const clean = cleanSocialHandle(value);
  return clean.startsWith("@") ? clean : `@${clean}`;
}

function cleanSocialHandle(value: string): string {
  return value.trim().replace(/^@/, "").replace(/[.,;:!?)]*$/g, "");
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, "").replace(/[().-]/g, "");
}

export function getUrlsFromRow(data: CreatorRow, columnMap: ColumnMap): string[] {
  const text = [getCell(data, columnMap, "Description"), getCell(data, columnMap, "URL")].join(" ");
  return Array.from(new Set(text.match(urlRegex)?.map(cleanUrl) ?? []));
}
