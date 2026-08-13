const expression = `(() => {
  const styleProperties = [
    'display', 'position', 'boxSizing', 'width', 'height', 'minWidth', 'minHeight',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'gap', 'rowGap', 'columnGap', 'alignItems', 'justifyContent',
    'gridTemplateColumns', 'flexGrow', 'flexShrink',
    'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'lineHeight',
    'letterSpacing', 'textAlign', 'textTransform', 'whiteSpace',
    'color', 'backgroundColor',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
    'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
    'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
    'boxShadow', 'opacity', 'overflow', 'overflowX', 'overflowY', 'transform', 'filter',
    'fill', 'stroke', 'strokeWidth',
  ];
  const customProperties = [
    '--ion-font-family', '--ion-safe-area-top', '--ion-safe-area-right',
    '--ion-safe-area-bottom', '--ion-safe-area-left', '--background', '--color',
    '--border-color', '--border-width', '--border-radius', '--box-shadow',
    '--padding-start', '--padding-end', '--padding-top', '--padding-bottom',
    '--offset-top', '--offset-bottom', '--ion-color-primary', '--ion-color-medium',
  ];
  const relevantDeclarations = new Set(styleProperties.map((property) =>
    property.replace(/[A-Z]/g, (match) => '-' + match.toLowerCase())).concat(customProperties));
  const round = (value) => Math.round(value * 1000) / 1000;
  const rect = (element) => {
    const value = element.getBoundingClientRect();
    return { bottom: round(value.bottom), height: round(value.height), left: round(value.left),
      right: round(value.right), top: round(value.top), width: round(value.width) };
  };
  const visible = (element) => {
    if (!(element instanceof Element)) return false;
    const value = element.getBoundingClientRect();
    if (value.width <= 0 || value.height <= 0) return false;
    let current = element;
    while (current instanceof Element) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const root = current.getRootNode();
      current = current.parentElement || (root instanceof ShadowRoot ? root.host : null);
    }
    return true;
  };
  const firstVisible = (selector, root) => Array.from((root || document).querySelectorAll(selector)).find(visible) || null;
  const byText = (text, root) => Array.from((root || document).querySelectorAll('*'))
    .find((element) => visible(element) && (element.textContent || '').trim() === text) || null;
  const styles = (element) => {
    const computed = getComputedStyle(element);
    const values = {};
    styleProperties.forEach((property) => { values[property] = computed[property]; });
    customProperties.forEach((property) => { values[property] = computed.getPropertyValue(property).trim(); });
    return values;
  };
  const textRects = (element) => {
    const ranges = [];
    Array.from(element.childNodes).forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      ranges.push({ text: node.textContent.trim(), rects: Array.from(range.getClientRects()).map((value) => ({
        bottom: round(value.bottom), height: round(value.height), left: round(value.left),
        right: round(value.right), top: round(value.top), width: round(value.width),
      })) });
    });
    return ranges;
  };
  const candidateDeclarations = (element) => {
    const matches = [];
    const roots = [document];
    const nodeRoot = element.getRootNode();
    if (nodeRoot instanceof ShadowRoot) roots.push(nodeRoot);
    const walk = (rules, source) => Array.from(rules || []).forEach((rule) => {
      if (rule.cssRules && rule.cssRules.length > 0) {
        let active = true;
        const text = (rule.cssText || '').trim();
        if (text.indexOf('@media') === 0) {
          try { active = matchMedia(rule.conditionText || rule.media.mediaText).matches; } catch (error) { active = false; }
        } else if (text.indexOf('@supports') === 0) {
          try { active = CSS.supports(rule.conditionText || ''); } catch (error) { active = false; }
        }
        if (active) walk(rule.cssRules, source);
        return;
      }
      if (!rule.selectorText || !rule.style) return;
      let matched = false;
      try { matched = element.matches(rule.selectorText); } catch (error) { matched = false; }
      if (!matched) return;
      const declarations = {};
      Array.from(rule.style).forEach((property) => {
        if (relevantDeclarations.has(property)) declarations[property] = {
          important: rule.style.getPropertyPriority(property) === 'important',
          value: rule.style.getPropertyValue(property).trim(),
        };
      });
      if (Object.keys(declarations).length > 0) matches.push({ declarations, selector: rule.selectorText, source });
    });
    roots.forEach((root) => Array.from(root.styleSheets || []).forEach((sheet, index) => {
      try { walk(sheet.cssRules, sheet.href || ('inline:' + index)); } catch (error) {
        matches.push({ error: String(error), source: sheet.href || ('inline:' + index) });
      }
    }));
    return matches;
  };
  const describe = (label, element) => element ? {
    label, tag: element.tagName.toLowerCase(), text: (element.textContent || '').trim().replace(/\\s+/g, ' '),
    rect: rect(element), styles: styles(element), textRects: textRects(element),
    candidateDeclarations: candidateDeclarations(element), visible: visible(element),
  } : { label, missing: true };

  const period = firstVisible('[aria-label="Statistics period"]');
  const page = period ? period.closest('.ion-page') : null;
  const stack = period ? period.parentElement : null;
  const summary = stack ? Array.from(stack.children).find((element) => element.tagName === 'SECTION') : null;
  const breakdown = summary ? Array.from(stack.children).find((element) => element.tagName === 'SECTION' && element !== summary) : null;
  const tablist = breakdown ? breakdown.querySelector('[role="tablist"]') : null;
  const content = page ? page.querySelector('ion-content') : null;
  const contentRoot = content && content.shadowRoot;
  const headerSurface = page ? page.querySelector('[data-testid="history-header-surface"]') : null;
  const searchbar = headerSurface ? headerSurface.querySelector('ion-searchbar') : null;
  const backButton = headerSurface ? headerSurface.querySelector('[aria-label="Back"]') : null;
  const filterButton = headerSurface ? headerSurface.querySelector('[aria-label$="history filters"]') : null;
  const nodes = [
    describe('html', document.documentElement), describe('body', document.body),
    describe('statistics-header', page ? page.querySelector('ion-header') : null),
    describe('header-surface', headerSurface), describe('header-searchbar', searchbar),
    describe('header-back-button', backButton),
    describe('header-back-native', backButton && backButton.shadowRoot ? backButton.shadowRoot.querySelector('[part="native"]') : null),
    describe('header-back-inner', backButton && backButton.shadowRoot ? backButton.shadowRoot.querySelector('.button-inner') : null),
    describe('header-filter-button', filterButton),
    describe('statistics-content', content),
    describe('statistics-content-background', contentRoot ? contentRoot.querySelector('[part="background"]') : null),
    describe('statistics-content-scroll', contentRoot ? contentRoot.querySelector('[part="scroll"]') : null),
    describe('page-shell', stack ? stack.parentElement : null), describe('stack', stack),
    describe('period-group', period), describe('summary-panel', summary),
    describe('summary-eyebrow', summary ? byText('Sessions', summary) : null),
    describe('summary-heading', summary ? byText('24 sessions', summary) : null),
    describe('metric-grid', summary ? Array.from(summary.querySelectorAll('div')).find((element) =>
      Array.from(element.children).some((child) => (child.textContent || '').trim() === 'Dry leaf167.5 g')) : null),
    describe('breakdown-panel', breakdown), describe('breakdown-tablist', tablist),
    describe('breakdown-eyebrow', breakdown ? byText('Breakdown', breakdown) : null),
    describe('breakdown-heading', breakdown ? byText('Tea profile', breakdown) : null),
    describe('breakdown-context', breakdown ? byText('by sessions', breakdown) : null),
    describe('ranking-panel', breakdown ? breakdown.querySelector('[role="tabpanel"]') : null),
    describe('tab-bar', firstVisible('ion-tab-bar')),
  ];
  Array.from(period ? period.querySelectorAll(':scope > button') : []).forEach((button, index) =>
    nodes.push(describe('period-button-' + index, button)));
  Array.from(summary ? summary.querySelectorAll(':scope > div:nth-child(2) > div') : []).forEach((card, index) => {
    nodes.push(describe('metric-card-' + index, card));
    nodes.push(describe('metric-label-' + index, card.firstElementChild));
    nodes.push(describe('metric-value-' + index, card.lastElementChild));
  });
  Array.from(tablist ? tablist.querySelectorAll(':scope > button') : []).forEach((button, index) =>
    nodes.push(describe('breakdown-tab-' + index, button)));
  Array.from(breakdown ? breakdown.querySelectorAll('[data-testid="statistics-ranking-row"]') : []).slice(0, 2)
    .forEach((row, index) => {
      nodes.push(describe('ranking-row-' + index, row));
      nodes.push(describe('ranking-labels-' + index, row.firstElementChild));
      nodes.push(describe('ranking-track-' + index, row.lastElementChild));
      nodes.push(describe('ranking-bar-' + index, row.lastElementChild ? row.lastElementChild.firstElementChild : null));
    });
  Array.from(document.querySelectorAll('ion-tab-button')).filter(visible).forEach((tab, index) => {
    const root = tab.shadowRoot;
    const icon = tab.querySelector(':scope > ion-icon');
    nodes.push(describe('tab-' + index + '-button', tab));
    nodes.push(describe('tab-' + index + '-native', root ? root.querySelector('[part="native"]') : null));
    nodes.push(describe('tab-' + index + '-icon', icon));
    nodes.push(describe('tab-' + index + '-label', tab.querySelector(':scope > ion-label')));
  });
  const rootStyle = getComputedStyle(document.documentElement);
  const coverage = {
    inspectedNodeCount: nodes.length,
    missingLabels: nodes.filter((node) => node.missing).map((node) => node.label),
    notVisibleLabels: nodes.filter((node) => !node.missing && !node.visible).map((node) => node.label),
  };
  return {
    coverage,
    fonts: {
      checks: { roboto300: document.fonts.check('300 16px Roboto'), roboto400: document.fonts.check('400 16px Roboto'), roboto500: document.fonts.check('500 16px Roboto') },
      faces: Array.from(document.fonts).map((face) => ({ family: face.family, status: face.status, weight: face.weight }))
        .filter((face) => face.family.indexOf('Roboto') >= 0),
      rootFamily: rootStyle.fontFamily, status: document.fonts.status,
    },
    ionic: { documentClasses: document.documentElement.className, documentMode: document.documentElement.getAttribute('mode') || '' },
    nodes,
    viewport: { clientHeight: document.documentElement.clientHeight, clientWidth: document.documentElement.clientWidth,
      devicePixelRatio: window.devicePixelRatio, innerHeight: window.innerHeight, innerWidth: window.innerWidth,
      visualViewport: window.visualViewport ? { height: round(window.visualViewport.height), width: round(window.visualViewport.width), scale: round(window.visualViewport.scale) } : null },
  };
})()`;

export const STATISTICS_DIAGNOSTICS_EXPRESSION = expression;
