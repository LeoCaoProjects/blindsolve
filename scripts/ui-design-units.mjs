/** Convert legacy design-pixel declarations to rem; 16 design px = 1rem.
 * Media queries stay viewport-based. Cube geometry is explicitly preserved.
 * Quoted values and URLs are assets/content, never sizing tokens.
 */
export function designUnits(value) {
  let result = "",
    i = 0;
  while (i < value.length) {
    const start = i;
    if (value[i] === '"' || value[i] === "'") {
      const quote = value[i++];
      while (i < value.length) {
        if (value[i++] === "\\") i++;
        else if (value[i - 1] === quote) break;
      }
    } else if (value.slice(i, i + 4).toLowerCase() === "url(") {
      i += 4;
      let depth = 1,
        quote = "";
      while (i < value.length && depth) {
        const char = value[i++];
        if (char === "\\") {
          i++;
          continue;
        }
        if (quote) {
          if (char === quote) quote = "";
        } else if (char === '"' || char === "'") quote = char;
        else if (char === "(") depth++;
        else if (char === ")") depth--;
      }
    } else {
      const token =
        !/[\w.-]/.test(value[i - 1] ?? "") &&
        value.slice(i).match(/^(-?(?:\d*\.)?\d+)px\b/);
      if (token) {
        result += `${Number((Number(token[1]) / 16).toFixed(8))}rem`;
        i += token[0].length;
        continue;
      }
      i++;
    }
    result += value.slice(start, i);
  }
  return result;
}

export default function uiDesignUnits() {
  return {
    postcssPlugin: "blindsolve-design-units",
    OnceExit(root) {
      root.walkDecls((decl) => {
        // Preserve physical cube geometry and the historical Aa utility dimensions.
        if (
          decl.parent.type === "rule" &&
          /(?:\.timer-(?:layout|cube-viewport|reference-column)|\.cube-utility-(?:control|mode|letters))\b/.test(
            decl.parent.selector,
          )
        )
          return;
        decl.value = designUnits(decl.value);
      });
    },
  };
}
