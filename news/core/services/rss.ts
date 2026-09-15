/** محلّل خلاصات RSS 2.0 و Atom و RDF إلى عناصر موحّدة. */
import { XMLParser } from "fast-xml-parser";
import { absolutize, decodeEntities, firstImageFromHtml, stripHtml, toIso } from "./text";

export interface FeedItem {
  title: string;
  url: string;
  summaryHtml: string;
  contentHtml: string;
  author: string | null;
  publishedAt: string;
  imageUrl: string | null;
  categories: string[];
  guid: string | null;
}

export interface ParsedFeed {
  title: string;
  link: string | null;
  items: FeedItem[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
});

type Node = Record<string, unknown> | string | undefined | null;

function text(v: Node): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return text(v[0] as Node);
  const o = v as Record<string, unknown>;
  if (typeof o["#cdata"] === "string") return o["#cdata"] as string;
  if (typeof o["#text"] === "string") return o["#text"] as string;
  return "";
}

function attr(v: Node, name: string): string {
  if (!v || typeof v !== "object") return "";
  const val = (v as Record<string, unknown>)[`@_${name}`];
  return typeof val === "string" ? val : "";
}

function arr<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function linkOf(entry: Record<string, unknown>): string {
  const links = arr(entry.link as Node | Node[]);
  let alternate = "";
  for (const l of links) {
    if (typeof l === "string") return l.trim();
    const href = attr(l, "href");
    const rel = attr(l, "rel");
    if (href && (!rel || rel === "alternate")) alternate = alternate || href;
  }
  if (alternate) return alternate;
  const guid = entry.guid as Node;
  const g = text(guid);
  if (g.startsWith("http")) return g;
  return "";
}

function mediaImage(entry: Record<string, unknown>, base: string): string | null {
  const candidates: Node[] = [
    ...arr(entry["media:content"] as Node | Node[]),
    ...arr(entry["media:thumbnail"] as Node | Node[]),
    ...arr(entry.enclosure as Node | Node[]),
  ];
  const group = entry["media:group"] as Record<string, unknown> | undefined;
  if (group) candidates.push(...arr(group["media:content"] as Node | Node[]), ...arr(group["media:thumbnail"] as Node | Node[]));
  for (const c of candidates) {
    const url = attr(c, "url");
    const type = attr(c, "type");
    const medium = attr(c, "medium");
    if (!url) continue;
    if (type && !type.startsWith("image")) continue;
    if (medium && medium !== "image") continue;
    const abs = absolutize(url, base);
    if (abs) return abs;
  }
  return null;
}

export function parseFeed(xml: string, baseUrl: string): ParsedFeed {
  const clean = xml.replace(/^﻿/, "").trim();
  const doc = parser.parse(clean) as Record<string, unknown>;
  const rss = doc.rss as Record<string, unknown> | undefined;
  const channel = (rss?.channel ?? (doc["rdf:RDF"] as Record<string, unknown> | undefined)?.channel) as Record<string, unknown> | undefined;
  const feed = doc.feed as Record<string, unknown> | undefined;

  const items: FeedItem[] = [];

  if (channel || doc["rdf:RDF"]) {
    const rawItems = arr((channel?.item ?? (doc["rdf:RDF"] as Record<string, unknown> | undefined)?.item) as Record<string, unknown> | Record<string, unknown>[]);
    for (const it of rawItems) {
      const title = decodeEntities(stripHtml(text(it.title as Node)));
      const url = linkOf(it);
      if (!title || !url) continue;
      const content = text(it["content:encoded"] as Node);
      const summary = text(it.description as Node) || text(it.summary as Node);
      const html = content || summary;
      items.push({
        title,
        url: absolutize(url, baseUrl) ?? url,
        summaryHtml: summary,
        contentHtml: content,
        author: text(it["dc:creator"] as Node) || text(it.author as Node) || null,
        publishedAt: toIso(text(it.pubDate as Node) || text(it["dc:date"] as Node) || text(it.published as Node)),
        imageUrl: mediaImage(it, baseUrl) ?? firstImageFromHtml(html, baseUrl),
        categories: arr(it.category as Node | Node[]).map((c) => text(c)).filter(Boolean),
        guid: text(it.guid as Node) || null,
      });
    }
    return { title: decodeEntities(text(channel?.title as Node)), link: text(channel?.link as Node) || null, items };
  }

  if (feed) {
    for (const it of arr(feed.entry as Record<string, unknown> | Record<string, unknown>[])) {
      const title = decodeEntities(stripHtml(text(it.title as Node)));
      const url = linkOf(it);
      if (!title || !url) continue;
      const content = text(it.content as Node);
      const summary = text(it.summary as Node);
      const html = content || summary;
      const authorNode = it.author as Record<string, unknown> | undefined;
      items.push({
        title,
        url: absolutize(url, baseUrl) ?? url,
        summaryHtml: summary,
        contentHtml: content,
        author: authorNode ? text(authorNode.name as Node) || null : null,
        publishedAt: toIso(text(it.published as Node) || text(it.updated as Node)),
        imageUrl: mediaImage(it, baseUrl) ?? firstImageFromHtml(html, baseUrl),
        categories: arr(it.category as Node | Node[]).map((c) => attr(c, "term") || text(c)).filter(Boolean),
        guid: text(it.id as Node) || null,
      });
    }
    return { title: decodeEntities(text(feed.title as Node)), link: null, items };
  }

  throw new Error("صيغة الخلاصة غير معروفة (ليست RSS ولا Atom)");
}
