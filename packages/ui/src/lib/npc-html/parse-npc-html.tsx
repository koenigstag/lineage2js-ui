import { createElement, type ReactNode } from "react";

// Structural tags with real HTML/CSS equivalents in L2's html dialect --
// passed through as the real element, with their (legacy, but still
// browser-honored) presentational attributes intact. tbody/thead/tfoot are
// here purely so they survive the walk -- DOMParser already inserts an
// implicit <tbody> around bare <tr>s per the HTML5 parsing algorithm same as
// a real page load, but without these in the allowlist that tbody would hit
// the "unrecognized tag" branch below and get unwrapped, flattening its
// <tr>s directly into <table> (React then refuses to render that: "tr
// cannot appear as a child of table").
const STRUCTURAL_TAGS = new Set(["table", "tbody", "thead", "tfoot", "tr", "td", "br", "center"]);

// Split the difference between a measured 16px (paragraph-to-paragraph) and
// 14px (link-to-link) -- see the "br" case in walk() below.
const PARAGRAPH_SPACING_PX = 15;

// Only elements whose HTML content model is "zero or more of a specific set
// of element types" -- a whitespace-only text node here (eg. a newline
// between <table> and <tr>) is invalid content React's DOM validator warns
// loudly about, unlike everywhere else in the dialect where whitespace is
// ordinary, meaningful text.
const TABLE_SECTION_TAGS = new Set(["table", "tbody", "thead", "tfoot", "tr"]);

const STRUCTURAL_ATTRIBUTES = [
  "width",
  "height",
  "align",
  "valign",
  "border",
  "cellspacing",
  "cellpadding",
  "colspan",
  "rowspan",
];

// React only recognizes these legacy table attributes in their camelCase DOM
// property spelling -- everything else in STRUCTURAL_ATTRIBUTES passes
// through fine as a plain lowercase HTML attribute name.
const ATTRIBUTE_PROP_NAMES: Record<string, string> = {
  cellspacing: "cellSpacing",
  cellpadding: "cellPadding",
  colspan: "colSpan",
  rowspan: "rowSpan",
};

// Tags with L2-specific semantics -- rendered by the registered l2-* custom
// elements (see npc-html-elements.ts), not by any real HTML meaning their
// tag name might otherwise carry.
const CUSTOM_TAGS: Record<string, { tag: string; attributes: string[] }> = {
  font: { tag: "l2-font", attributes: ["color", "name"] },
  a: { tag: "l2-link", attributes: ["action"] },
  img: { tag: "l2-img", attributes: ["width", "height"] },
};

function pickAttributes(element: Element, names: string[]): Record<string, string> {
  const props: Record<string, string> = {};
  for (const name of names) {
    const value = element.getAttribute(name);
    if (value !== null) {
      props[ATTRIBUTE_PROP_NAMES[name] ?? name] = value;
    }
  }
  return props;
}

function isWhitespaceOnlyText(node: ChildNode): boolean {
  return node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() === "";
}

// The actual safety boundary: only tags/attributes named here ever reach a
// real DOM node. Never spread a parsed element's full attribute list onto
// anything -- an onclick/onerror/... string is executable the moment it's a
// real attribute on a real rendered node, so every tag below opts into an
// explicit, short attribute allowlist instead.
function walk(node: ChildNode, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const childNodes = TABLE_SECTION_TAGS.has(tagName)
    ? Array.from(element.childNodes).filter((child) => !isWhitespaceOnlyText(child))
    : Array.from(element.childNodes);
  const children = childNodes.flatMap((child, index) => {
    const result = walk(child, index);
    return Array.isArray(result) ? result : [result];
  });

  if (tagName === "br") {
    // <br> is how this dialect marks the end of both a paragraph and a link
    // line -- measured samples wanted 16px after a paragraph and 14px after
    // a link, split into one shared value rather than threading "was this
    // the br after a link" context through the walk for a 2px difference.
    return createElement("br", { key, style: { display: "block", marginBottom: PARAGRAPH_SPACING_PX } });
  }

  if (STRUCTURAL_TAGS.has(tagName)) {
    return createElement(tagName, { key, ...pickAttributes(element, STRUCTURAL_ATTRIBUTES) }, ...children);
  }

  const custom = CUSTOM_TAGS[tagName];
  if (custom) {
    return createElement(custom.tag, { key, ...pickAttributes(element, custom.attributes) }, ...children);
  }

  // Unrecognized tag (including anything actively hostile, e.g. <script>) --
  // drop the wrapper but keep its children/text, rather than either
  // rendering it as a real element or silently swallowing the content.
  // <script>'s children are its source text, not executable code, once
  // routed through here rather than innerHTML.
  return children;
}

/** Parses one NpcHtmlMessage.html string into safe-to-render React nodes. See walk()'s allowlist comment for the actual security boundary. */
export function parseNpcHtml(html: string): ReactNode {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.body.childNodes).flatMap((node, index) => {
    const result = walk(node, index);
    return Array.isArray(result) ? result : [result];
  });
}
