// Web Components backing parse-npc-html.tsx's l2-* tags. Each one owns the
// translation from L2's html dialect into real rendering/behavior in one
// place, rather than scattering that logic through the parser's tree walk.

// L2's <font color="..."> can be a real hex string or one of a handful of
// named UI tokens the retail client resolves against its own theme. There's
// no reference table for these anywhere in this codebase (or the
// L2ClientDat/lineage2ts sources this feature was built against) -- this is
// a best-effort starting point, not verified pixel-for-pixel against the
// real client. Extend as real dialogue samples turn up unmapped tokens.
const NAMED_COLOR_TOKENS: Record<string, string> = {
  LEVEL: "#ffe066",
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

// <a action="bypass -h npc_%objectId%_Chat 0">text</a> -- not navigation.
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
      new CustomEvent<{ action: string }>("l2npcbypass", {
        detail: { action },
        bubbles: true,
        composed: true,
      })
    );
  };

  connectedCallback() {
    this.style.display = "inline";
    this.style.cursor = "pointer";
    this.style.textDecoration = "underline";
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
