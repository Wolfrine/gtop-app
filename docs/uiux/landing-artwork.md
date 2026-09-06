# Landing artwork

Five original raster assets were generated using the built-in image-generation tool for this landing page. They are decorative promotional artwork, not scientific diagrams. The interactive circuit is native SVG and HTML so its state remains exact and accessible.

| Asset | Composition brief |
| --- | --- |
| `hero-discovery.webp` | Wide midnight-blue editorial still life: an open ivory book unfolds into ribbon pages, globe with brass orbit, glass prism and geometric sculptures. Warm sunlight; quiet left area for live text. |
| `hero-discovery-mobile.webp` | Art-directed portrait edit of the first hero: the same subjects arranged vertically, complete book and objects within the frame, no large left blank area. Created after the desktop image cropped poorly in actual phone review. |
| `subject-science.webp` | Optical glass prism and a spectrum on a deep cobalt studio plinth. Large clear silhouette. |
| `subject-mathematics.webp` | Terracotta torus, folded ivory geometric star, coral sphere and paper ribbon under warm directional light. |
| `subject-biology.webp` | Backlit green leaf with dew, a pale ceramic arc and a green sphere on a fresh mint background. |

Generation constraints: sophisticated tactile materials, coherent light and colour, useful negative space, no logos, text, UI or watermarks. The mobile edit preserves the first hero's material and lighting identity. Generated paper details are decorative and carry no teaching content.

Web assets preserve the generated image dimensions and use WebP quality 82. The hero uses a picture source selected by viewport width; only one hero is requested for a given viewport. Supporting images are lazy loaded. Live headings, labels, buttons and all interaction remain HTML.

Do not replace the mobile artwork with a center crop of the desktop image without reviewing the full phone composition. Main page source lives in the existing V1 landing component; the authenticated learner interface retains its own visual treatment.
