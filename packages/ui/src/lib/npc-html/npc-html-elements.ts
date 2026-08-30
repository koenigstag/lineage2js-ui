// Web Components backing parse-npc-html.tsx's l2-* tags. Each one owns the
// translation from L2's html dialect into real rendering/behavior in one
// place, rather than scattering that logic through the parser's tree walk.

import { POINTER_CURSOR } from "../../config/cursor-urls";

// L2's <font color="..."> can be a real hex string or one of a handful of
// named UI tokens the retail client resolves against its own theme. There's
// no reference table for these anywhere in this codebase (or the
// L2ClientDat/lineage2ts sources this feature was built against) -- this is
// a best-effort starting point, not verified pixel-for-pixel against the
// real client. Extend as real dialogue samples turn up unmapped tokens.
const NAMED_COLOR_TOKENS: Record<string, string> = {
  LEVEL: "#f9c701",
};

function resolveFontColor(color: string | null): string | undefined {
  if (!color) {
    return undefined;
  }
  const token = NAMED_COLOR_TOKENS[color.toUpperCase()];
  if (token) {
    return token;
  }
  if (/^[0-9a-fA-F]{6}$/.test(color)) {
    return `#${color}`;
  }
  if (color.startsWith("#")) {
    return color;
  }
  return undefined;
}

class L2FontElement extends HTMLElement {
  static get observedAttributes() {
    return ["color", "name"];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    this.style.display = "inline";
    this.style.color = resolveFontColor(this.getAttribute("color")) ?? "inherit";
  }
}

// <a action="bypass -h npc_%objectId%_Chat 0">text</a> and
// <a action="link somefile.htm">text</a> -- neither is navigation. Both
// carry a local-execution prefix that is not part of the payload: the
// server's own HtmlActionCache strips it the same way before caching each
// link's real action (and, once a dialogue has been through its
// obfuscation pass, before matching an incoming click against that cache)
// -- lineage2ts's HtmlActionCache.validateHtmlAction() looks up the text
// verbatim, so sending the prefix along with it is just a cache miss: the
// server returns bypassOriginId -1 and silently drops the request, no
// error, no reply. Confirmed against lineage2ts's own reference client
// (server-testing/source/client/systems/HtmlBrowser.ts), which strips the
// identical "bypass -h "/"bypass " prefix before sending.
//
// "link" is not just a spelling variant of "bypass": it is a genuinely
// different packet on the wire (RequestLinkHtml, opcode 0x22, vs
// RequestBypassToServer's 0x23) that names another html page to load
// rather than a server-side command to run -- confirmed live: a dialogue's
// numbered "Chat N"-style continuation link used action="link ..." while
// its sibling keyword bypasses ("Quest", "TerritoryStatus") used
// "bypass -h ...", and only the latter reached the server at all before
// this was handled, since both were being sent as a bypass regardless of
// which prefix they carried.
const LINK_PREFIX = "link ";
const BYPASS_H_PREFIX = "bypass -h ";
const BYPASS_PREFIX = "bypass ";

export interface NpcAction {
  kind: "bypass" | "link";
  command: string;
}

function parseNpcAction(action: string): NpcAction {
  if (action.startsWith(LINK_PREFIX)) {
    return { kind: "link", command: action.slice(LINK_PREFIX.length) };
  }
  if (action.startsWith(BYPASS_H_PREFIX)) {
    return { kind: "bypass", command: action.slice(BYPASS_H_PREFIX.length) };
  }
  if (action.startsWith(BYPASS_PREFIX)) {
    return { kind: "bypass", command: action.slice(BYPASS_PREFIX.length) };
  }
  return { kind: "bypass", command: action };
}

// Dispatches a bubbling CustomEvent instead of taking a callback prop: React
// 18 passes non-standard custom-element props to the DOM as string
// attributes only (not JS properties the way React 19 does), so a function
// prop wouldn't reach this element via JSX/createElement anyway.
class L2LinkElement extends HTMLElement {
  private handleClick = () => {
    const action = this.getAttribute("action");
    if (!action) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<NpcAction>("l2npcbypass", {
        detail: parseNpcAction(action),
        bubbles: true,
        composed: true,
      })
    );
  };

  connectedCallback() {
    this.style.display = "inline";
    this.style.cursor = POINTER_CURSOR;
    this.style.textDecoration = "underline";
    this.style.color = "#6496f9";
    this.addEventListener("click", this.handleClick);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.handleClick);
  }
}

// <img src="symbol.credit_FQA"> -- src references an arbitrary client UI
// sprite name, not a URL or a small numeric id like the item/skill/action
// icon maps in config/icon-urls.ts. No conversion/serving pipeline exists
// for that (open-ended: every sprite any dialogue might reference, not a
// fixed enumerable set) -- v1 just reserves the layout space.
class L2ImgElement extends HTMLElement {
  static get observedAttributes() {
    return ["width", "height"];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render() {
    const width = this.getAttribute("width");
    const height = this.getAttribute("height");
    this.style.display = "inline-block";
    this.style.verticalAlign = "middle";
    this.style.width = width ? `${width}px` : "16px";
    this.style.height = height ? `${height}px` : "16px";
    this.style.background = "rgba(255, 255, 255, 0.06)";
  }
}

let registered = false;

export function registerNpcHtmlElements() {
  if (registered) {
    return;
  }
  registered = true;

  customElements.define("l2-font", L2FontElement);
  customElements.define("l2-link", L2LinkElement);
  customElements.define("l2-img", L2ImgElement);
}
