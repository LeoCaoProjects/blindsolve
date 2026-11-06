import policy from "../src/styles/viewport-layout.json" with { type: "json" };
// Layout properties only. Colour, opacity and motion/accessibility queries retain
// their ordinary CSS behavior. Existing class names and the default app survive.
const geometry =
  /^(?:display|position|inset(?:-.+)?|top|right|bottom|left|order|(?:min-|max-)?(?:width|height)|grid(?:-.+)?|flex(?:-.+)?|(?:row-|column-)?gap|padding(?:-.+)?|margin(?:-.+)?|overflow(?:-.+)?|align(?:-.+)?|justify(?:-.+)?|font-size|line-height|text-align|border(?:-.+)?(?:width|style))$/;

export default function viewportLayoutCss() {
  return {
    postcssPlugin: "blindsolve-viewport-layout",
    OnceExit(root) {
      const media = [];
      root.walkAtRules("media", (node) => media.push(node));
      for (const node of media) {
        let condition = "",
          matched = false;
        const remaining = node.params
          .replace(
            /\(\s*(min|max)-width\s*:\s*(\d+)px\s*\)/g,
            (whole, direction, value) => {
              const size = Number(value) + (direction === "max" ? 1 : 0);
              const name = Object.keys(policy.breakpoints).find(
                (key) => key !== "context" && policy.breakpoints[key] === size,
              );
              if (!name) return whole;
              matched = true;
              condition +=
                direction === "min"
                  ? `[data-viewport-layout~="${name}"]`
                  : `:not([data-viewport-layout~="${name}"])`;
              return "";
            },
          )
          .trim()
          .replace(/^and\s+|\s+and$/g, "")
          .trim();
        // Unknown widths/compound OR expressions keep their original semantics.
        if (!matched || /\bwidth\b|,|\bor\b/.test(remaining)) continue;
        const alternatives = [];
        node.walkRules((rule) => {
          if (rule.selector.includes("data-viewport-")) return;
          const layout = rule.nodes.filter(
            (child) => child.type === "decl" && geometry.test(child.prop),
          );
          if (!layout.length) return;
          const selectors = rule.selectors;
          const managed = rule.clone({ nodes: [] });
          managed.append(layout.map((decl) => decl.clone()));
          managed.selectors = selectors.map(
            (selector) =>
              `:where(html[data-viewport-sizing]${condition}) ${selector}`,
          );
          alternatives.push(managed);
          const fallback = rule.clone({ nodes: [] });
          fallback.append(layout.map((decl) => decl.clone()));
          fallback.selectors = selectors.map(
            (selector) =>
              `:where(html:not([data-viewport-sizing])) ${selector}`,
          );
          layout.forEach((decl) => decl.remove());
          rule.after(fallback);
          if (!rule.nodes.length) rule.remove();
        });
        if (!alternatives.length) continue;
        if (remaining) {
          const alternate = node.clone({ params: remaining, nodes: [] });
          alternate.append(alternatives);
          node.after(alternate);
        } else node.after(alternatives);
      }
    },
  };
}
viewportLayoutCss.postcss = true;
