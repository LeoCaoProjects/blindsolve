# CubeIQ — training instrument

Typography: self-hosted Source Sans 3 variable, 16px/1.5 body. IBM Plex Mono for timers, scrambles and targets. UI sizes 12,14,16,18,24,28px. Timer 80–136px with tabular figures. Normal/medium headings; no marketing scale. Font fallbacks are system sans/monospace; layout does not depend on late external font requests.

Spacing: 4,8,12,16,24,32,48,64px. Dense data uses 8/12; page edges 20/24/32; exercise separation 48. Main content is 1280px inside its padded shell; settings/practice width 1040px, recall forms 620px. Wide screens keep the tool centered, not stretched.

Palette: off-white #f4f5f2, white work surface, graphite #202724, secondary #5c6761, line #d3d9d3, accent #31664d. Dark: #191d1b, #202622, text #eef1ed, secondary #a8b3aa, line #3e4941, accent #a4c8ae. Cube colors reserved for actual facelet information. Success uses accent plus text; error rust red; warning muted ochre. No gradient/glass/glow.

Controls: 6px radius, framed surfaces 8px, dialog 10px. Buttons 38px desktop and 44px mobile, with compact text actions. No hover transforms. Focus outline 2px offset 3px. Selected matrix cell uses an inset outline and named coordinates. Borders group tables/forms; not every block needs a container. Shadow only the elevated dialog, 0 18px 60px #0003.

Navigation: real URL routes with compact top tabs on desktop, bottom labels/icons below 700px. Settings visually quieter. Main landmarks and skip link; route headings focused after navigation. Focus mode reserves layout and recedes secondary content.

Components: native button/input/select/dialog; labels above inputs; field-level validation; named close actions; dialog focus restore. Matrix is a native table with roving button focus, arrows/Home/End and Enter. Search returns a compact list instead of invisible holes. Practice is typography-led; paired targets separated by spacing, not token pills. Distinct layouts for timing, data, recall and settings.

Motion: color/opacity only, 120ms; reduced motion removes transitions. Timer display alone updates on requestAnimationFrame. No auto-animation of cube algorithms.

Breakpoints: 700px mobile, 1024px compact; grid intentionally scrolls horizontally, page does not. On mobile cube moves below timer and stays compact; form controls keep 16px text and full usable width. Minimum viewport 320px.

Identity: two offset sticker outlines; used only as compact logo/favicon. Monochrome 16–20px icons for navigation/actions with labels. No decorative icon headings.
