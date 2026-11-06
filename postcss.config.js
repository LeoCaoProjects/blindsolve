import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import uiDesignUnits from './scripts/ui-design-units.mjs';

export default { plugins: [tailwindcss(), uiDesignUnits(), autoprefixer()] };
