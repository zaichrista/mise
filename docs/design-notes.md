# Current visual direction

## Tablet first

The cooking interface uses a two-column arrangement on screens wider than 660 CSS pixels: instructions and ingredient quantities on the left, a separate action area on the right. It falls back to one column on smaller screens. The preview fills its available width up to a 1280-pixel page maximum.

The main action uses a **196 × 196 CSS-pixel** tap area, with rounded square corners by default. Circle changes the corner radius, retaining the same bounding dimensions. In-body suggestion actions are smaller square targets, and secondary actions have their own separated tap zones. The primary button's headline and supporting text are intentionally brief.

The main action stays near the top of the right-hand area. Read step and Overview sit lower in separate square targets. The current instruction, quantities and running timer remain visible together.

## Two directions

- **Recipe journal:** cream paper, burgundy actions, serif headings, warm editorial spacing.
- **Counter focus:** sage surfaces, green actions, sans-serif headings, running work above the current instruction.

Both support light and dark appearance through `light-dark()` colours and the device's appearance preference. Mise is a working product name.

## Editing map

`styles.css` starts with preview controls, then the product's base styles. The section marked **Tablet cooking surface** contains the current tablet layout and button sizing. Later rules take precedence over the earlier base rules.

In `app.js`:

- `button()` defines the short action headline, supporting text and icon.
- `body()` contains each screen's copy and structure.
- `running()` defines the independent timer summary.
- `render()` applies the selected screen, direction and button shape.
- The delegated click handler demonstrates local interactions.
- `save()` remembers prototype preferences only.

Keep the specification's distinction between navigation, accepting a suggestion, starting a physical task, confirming completion and acknowledging a timer alert. The current prototype illustrates this distinction but does not implement the full task model.

## Assets

Lucide version 1.17.0 is bundled in `vendor/lucide.js`, with its complete licence in `vendor/LUCIDE-LICENSE`. Fonts are system fonts; no remote resources are needed. Keep the vendor licence with any redistributed copy.
