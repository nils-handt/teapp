# Tea Consumption Statistics Dashboard Design

## Goal

Add a dedicated tea-consumption statistics page to History. The page must use the same live search and Tea attribute filters as the History list, add rolling time-period filtering, and summarize only completed brewing sessions.

The first version answers four questions:

1. How much dry tea leaf and brewed liquid has the user consumed?
2. Which Tea types, specific Tea entities, and brands has the user brewed most often?
3. What does an average brewing session look like?
4. How broadly has the user explored their Tea collection?

## Navigation and Page Structure

History keeps its current list-focused layout. A square icon button using Ionic's `pieChartOutline` icon sits immediately to the right of the `Search teas` bar. It has the accessible label `Open tea statistics` and navigates to `/tabs/history/statistics`.

`/tabs/history/statistics` is declared before `/tabs/history/:sessionId` in `Tabs.tsx`, so `statistics` cannot be interpreted as a session ID. The page remains inside the History tab and provides a normal back affordance to History.

The Statistics page is ordered as follows:

1. Page heading and back affordance.
2. The same Tea search and expandable Tea attribute filters used by History.
3. Period selector: Total, Last year, Last month, Last week.
4. Total metric cards: completed sessions, dry leaf, and liquid.
5. One tabbed ranking card with Tea types, Tea names, and Brands tabs.
6. Brewing averages card.
7. Tea exploration card.

The ranking card follows the structural tab styling of the existing Tea editor: a full-width tab strip forms the top of the card, the active tab uses the light panel surface, and inactive tabs use a muted Zen background. Colors follow the current Zen palette rather than copying literal colors from the reference screenshot.

## Shared Tea Filters

History and Statistics share one runtime filter state containing:

- Search text.
- Name.
- Brand.
- Type.
- Subtype.
- Region.
- Subregion.
- Season.
- Year.

Changing a filter on either page immediately changes the other page's state. Filter expansion/collapse is local presentation state for each page and is not shared. Tea filters are not persisted across an app restart.

A shared filter component renders the search input, suggestions, filter toggle, active-filter count, clear action, and attribute fields. A shared pure filtering function applies fuzzy Tea search and the Tea attribute filters so History and Statistics cannot drift into different matching behavior.

Refreshing either page reloads sessions and Tea entities but does not clear the shared Tea filter values. The saved statistics period also remains unchanged.

## Period Selection

The period selector accepts exactly these values:

- `total`: no date boundary.
- `lastYear`: `startTime` is within the previous 365 days.
- `lastMonth`: `startTime` is within the previous 30 days.
- `lastWeek`: `startTime` is within the previous 7 days.

Boundaries are rolling from the current instant and inclusive. A session exactly on the lower boundary counts. Period filtering uses the brewing session's `startTime`. Sessions with invalid dates can count for Total but cannot count for a rolling period.

The selected value is stored as `statisticsPeriod` in `useSettingsStore` and persisted through the existing settings repository. With no saved value, or with an invalid saved value, the selector uses `total`. Selecting a period updates the dashboard immediately and saves the new value.

## Eligible Sessions and Calculation Pipeline

The dashboard applies data in this order:

1. Start with the loaded History sessions and Tea entities.
2. Apply the shared fuzzy search and Tea attribute filters.
3. Keep only sessions whose status is exactly `completed`.
4. Apply the selected rolling period.
5. Aggregate the remaining sessions.

All statistics on the page derive from this one eligible-session array.

Missing, non-finite, or negative weight values contribute zero. A missing infusion array is treated as an empty array.

### Totals

- **Sessions:** number of eligible completed sessions.
- **Dry leaf:** sum of `dryTeaLeavesWeight` across eligible sessions.
- **Liquid:** sum of every infusion's `waterWeight` across eligible sessions. The app treats one gram of water as approximately one millilitre for display.

Dry leaf is displayed in grams with at most one decimal place. Liquid is displayed in millilitres below 1,000 ml and litres at or above 1,000 ml, with at most one decimal place. Trailing `.0` is omitted.

### Brewing Averages

The Brewing averages card appears after the ranking card and reports:

- Average dry leaf per eligible session.
- Average liquid per eligible session.
- Average infusion count per eligible session.

Each average uses the total eligible-session count as its denominator, including eligible sessions whose corresponding value is zero or missing. When there are no eligible sessions, all averages are zero.

### Tabbed Rankings

All ranking tabs use completed session count as their measure. Groups sort by descending session count, then case-insensitive display label for deterministic ties. Every row includes a text label, an exact session count, and a horizontal bar relative to the largest group in the active tab. The bar is supplementary; color or width is never the only carrier of information.

Each tab shows at most five groups initially. `Show all` appears only when more than five groups exist. Expanded state changes the action to `Show less`. Selecting another tab resets that tab to the default five-item view.

Grouping rules:

- **Tea types:** group case-insensitively by trimmed `tea.type`. A session without a non-empty type enters `Unknown`.
- **Tea names:** group by `teaId`, preserving distinct Tea entities even if their names match. Use the formatted Tea label for display. Sessions without a linked Tea entity remain in totals and averages but do not enter this ranking.
- **Brands:** group case-insensitively by trimmed `tea.brand`. A session without a non-empty brand enters `Unknown`.

Case-insensitive text groups retain the first non-empty trimmed spelling encountered for display. `Unknown` participates in ranking and can appear in the top five.

### Tea Exploration

The Tea exploration card reports distinct counts among eligible sessions:

- Tea entities, by `teaId`.
- Types, using normalized non-empty type values.
- Regions, using normalized non-empty region values.
- Subregions, using normalized non-empty subregion values.

Missing metadata and `Unknown` buckets do not count as something explored.

## Empty and Loading Behavior

While History data is loading, Statistics shows the page structure without stale calculations and a lightweight loading state in the content area. The screen catches a failed session or Tea load, logs it through the existing app logger, and shows `Statistics could not be loaded. Pull to refresh and try again.` A later successful refresh clears the error and renders the new result. Statistics reads through the existing repositories and does not add a second persistence path.

When no completed sessions match the shared Tea filters and period, metric and exploration values display as zero, the ranking card has no rows, and the page explains: `No completed sessions match these filters.` This is an empty result, not an error.

## Component and Module Boundaries

### Shared history filter state

A small Zustand store owns shared search text and Tea filter values plus update and clear actions. It contains view state only and does not load or persist database data.

### Shared History filters component

This component renders the search, suggestions, expandable fields, active count, and clear action. It depends on the filter store, loaded Tea entities, and callbacks for page-local expansion state.

### Statistics aggregation utility

A pure utility accepts sessions, a period, and an optional current time for deterministic tests. It returns one typed result containing totals, averages, exploration counts, and ranked type/name/brand groups. It has no React, routing, database, or store dependencies.

### Tabbed ranking card

The card owns its active tab and expanded/collapsed presentation state. It receives already-ranked groups and does not calculate statistics.

### Statistics screen

The screen loads History and Tea data on entry, applies the shared Tea filters, reads and updates the persisted period, calls the aggregation utility, and composes the approved page hierarchy.

### History screen

History switches from component-local filter values to the shared filter store, renders the shared filter component, and adds the pie-chart navigation action. Session list, navigation, delete, and Undo behavior remain unchanged.

## Accessibility

- The pie-chart navigation action has the explicit label `Open tea statistics`.
- The period selector exposes its selected value and is keyboard operable.
- The ranking strip uses `tablist`, `tab`, and `tabpanel` semantics, including selected state and keyboard operation.
- Ranking rows always expose group labels and exact session counts as text.
- `Show all` and `Show less` are buttons with unambiguous labels.
- Empty and loading states are readable text rather than icon-only signals.

## Verification

### Pure unit tests

- Completed sessions are included and active sessions are excluded.
- Total, 7-day, 30-day, and 365-day boundaries are inclusive and deterministic.
- Invalid dates are excluded only from rolling periods.
- Dry leaf, liquid, session totals, and all three averages are correct.
- Missing, negative, and non-finite weights contribute zero.
- Type and brand groups normalize case and use `Unknown` for missing values.
- Tea names group by `teaId` and exclude unlinked sessions only from that ranking.
- Rankings use descending count and deterministic label tie-breaking.
- Exploration counts ignore empty metadata and deduplicate normalized values.
- Empty input returns a fully zeroed result.

### Store and settings tests

- Search and Tea filter changes are shared between both screens.
- Clearing filters clears every shared value.
- `statisticsPeriod` defaults to Total, loads valid saved values, rejects invalid saved values, and persists updates.

### Component and routing tests

- History renders the accessible pie-chart action and navigates to the Statistics route.
- The Statistics route is not captured as a session detail ID.
- Statistics uses the shared filters and completed-session aggregation.
- Ranking tabs expose accessible semantics and switch datasets.
- Each tab defaults to five items and supports Show all/Show less.
- Empty, loading, and zero-value states render correctly.
- Existing History search, filters, deletion, Undo, and session navigation continue to work.

### Repository verification

Use `npm run test:sandbox -- ...` for the targeted utility, store, History, Statistics, settings, and routing tests, then run `npm run build`.

## Out of Scope

- Calendar-period modes such as current week, month, or year.
- Trend charts or time-series visualizations.
- Ranking by dry leaf or liquid instead of session count.
- Persisting Tea search and attribute filters across app restarts.
- Database-side aggregation or schema migrations.
- Exporting or sharing dashboard results.
