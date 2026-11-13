import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import uiDesignUnits from './scripts/ui-design-units.mjs';
import viewportLayoutCss from './scripts/viewport-layout-css.mjs';

export default { plugins: [tailwindcss(), uiDesignUnits(), viewportLayoutCss(), autoprefixer()] };
