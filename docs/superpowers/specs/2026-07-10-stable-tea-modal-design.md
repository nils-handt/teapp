# Stable Tea Modal Design

## Goal

Keep the tea selection modal at the same size as the New Tea tab while users
search and filter existing teas.

## Layout

- The modal panel has a stable height based on the New Tea form at the current
  viewport width.
- Its header and action buttons remain fixed within the panel.
- The panel body is the only scrollable region.
- In the Existing Tea tab, the search input stays above the results and the
  results consume the available body space. Longer result lists scroll there
  instead of changing the dialog height.
- The New Tea tab continues to use the same shared body area. Its form remains
  unchanged and can scroll on constrained viewports.

## Scope and Verification

This is a presentation-only change to `TeaEditorModal`; tea selection, search,
and save behaviour do not change. Add a component-level assertion for the
shared fixed-height layout classes and run the focused Tea editor test suite.
