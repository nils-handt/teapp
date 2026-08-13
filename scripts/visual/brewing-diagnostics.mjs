const BREWING_DIAGNOSTIC_STATE_NAMES = new Set([
  'brewing-idle',
  'brewing-setup',
  'brewing-ready',
  'brewing-infusion',
  'brewing-rest',
  'brewing-ended',
]);

export const isBrewingDiagnosticState = (name) => BREWING_DIAGNOSTIC_STATE_NAMES.has(name);

export const createBrewingDiagnosticsExpression = (captureName) => {
  if (!isBrewingDiagnosticState(captureName)) {
    throw new Error(`Unsupported Brewing diagnostics state: ${captureName}`);
  }

  return `(() => {
  const captureName = ${JSON.stringify(captureName)};
  const styleProperties = [
    'display', 'position', 'boxSizing', 'width', 'height', 'minWidth', 'minHeight',
    'maxWidth', 'maxHeight', 'top', 'right', 'bottom', 'left',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'marginInlineStart', 'marginInlineEnd',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'paddingInlineStart', 'paddingInlineEnd',
    'gap', 'rowGap', 'columnGap', 'alignItems', 'justifyContent',
    'flex', 'flexBasis', 'flexGrow', 'flexShrink', 'flexDirection',
    'gridTemplateColumns', 'gridTemplateRows', 'aspectRatio',
    'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'lineHeight',
    'letterSpacing', 'textAlign', 'textTransform', 'verticalAlign', 'whiteSpace', 'textOverflow',
    'color', 'background', 'backgroundColor', 'backgroundImage',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
    'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
    'borderTopLeftRadius', 'borderTopRightRadius',
    'borderBottomRightRadius', 'borderBottomLeftRadius',
    'boxShadow', 'opacity', 'overflow', 'overflowX', 'overflowY', 'visibility',
    'transform', 'filter', 'backdropFilter', 'appearance', 'contain', 'zIndex',
    'fill', 'stroke', 'strokeWidth',
  ];
  const customProperties = [
    '--ion-font-family', '--ion-safe-area-top', '--ion-safe-area-right',
    '--ion-safe-area-bottom', '--ion-safe-area-left', '--ion-statusbar-padding',
    '--background', '--background-activated', '--background-focused', '--background-hover',
    '--border-color', '--border-radius', '--border-style', '--border-width', '--box-shadow',
    '--color', '--color-activated', '--color-focused', '--color-hover',
    '--padding-start', '--padding-end', '--padding-top', '--padding-bottom',
    '--offset-top', '--offset-bottom', '--ripple-color',
    '--ion-color-base', '--ion-color-contrast', '--ion-color-medium', '--ion-color-primary',
  ];
  const relevantDeclarations = new Set([
    ...styleProperties.map((property) => property.replace(/[A-Z]/g, (match) => '-' + match.toLowerCase())),
    ...customProperties,
  ]);
  const round = (value) => Math.round(value * 1000) / 1000;
  const rect = (element) => {
    const value = element.getBoundingClientRect();
    return {
      bottom: round(value.bottom), height: round(value.height), left: round(value.left),
      right: round(value.right), top: round(value.top), width: round(value.width),
      x: round(value.x), y: round(value.y),
    };
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
  const interactiveByText = (text, root) => Array.from((root || document).querySelectorAll('button, ion-button'))
    .filter(visible)
    .filter((element) => (element.textContent || '').trim() === text)
    .sort((left, right) => (right.tagName === 'ION-BUTTON' ? 1 : 0) - (left.tagName === 'ION-BUTTON' ? 1 : 0))[0] || null;
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
  const matchingDeclarations = (element) => {
    const matches = [];
    const roots = [document];
    const nodeRoot = element.getRootNode();
    if (nodeRoot instanceof ShadowRoot) roots.push(nodeRoot);
    const conditionalRuleActive = (rule) => {
      if (typeof rule.matches === 'boolean') return rule.matches;
      const ruleText = (rule.cssText || '').trim();
      const condition = rule.conditionText || (rule.media && rule.media.mediaText) || '';
      if (ruleText.indexOf('@media') === 0) {
        try { return window.matchMedia(condition).matches; } catch (error) { return false; }
      }
      if (ruleText.indexOf('@supports') === 0) {
        try { return CSS.supports(condition); } catch (error) { return false; }
      }
      return true;
    };
    const walk = (rules, source) => Array.from(rules || []).forEach((rule) => {
      if (rule.cssRules && rule.cssRules.length > 0) {
        if (conditionalRuleActive(rule)) walk(rule.cssRules, source);
        return;
      }
      if (!rule.selectorText || !rule.style) return;
      let matched = false;
      try { matched = element.matches(rule.selectorText); } catch (error) { matched = false; }
      if (!matched) return;
      const declarations = {};
      Array.from(rule.style).forEach((property) => {
        if (relevantDeclarations.has(property)) {
          declarations[property] = {
            important: rule.style.getPropertyPriority(property) === 'important',
            value: rule.style.getPropertyValue(property).trim(),
          };
        }
      });
      if (Object.keys(declarations).length > 0) {
        matches.push({ declarations, selector: rule.selectorText, source });
      }
    });
    roots.forEach((root) => Array.from(root.styleSheets || []).forEach((sheet, index) => {
      try { walk(sheet.cssRules, sheet.href || ('inline:' + index)); } catch (error) {
        matches.push({ error: String(error), source: sheet.href || ('inline:' + index) });
      }
    }));
    return matches;
  };
  const describe = (label, element) => {
    if (!element) return { label, missing: true };
    return {
      attributes: Array.from(element.attributes || []).reduce((result, attribute) => {
        result[attribute.name] = attribute.value;
        return result;
      }, {}),
      box: {
        clientHeight: element.clientHeight, clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight, scrollWidth: element.scrollWidth,
      },
      label,
      matchedDeclarations: matchingDeclarations(element),
      mode: element.mode || element.getAttribute('mode') || '',
      part: element.getAttribute('part') || '',
      rect: rect(element), styles: styles(element), tag: element.tagName.toLowerCase(),
      text: (element.textContent || '').trim().replace(/\\s+/g, ' '),
      textRects: textRects(element), visible: visible(element),
    };
  };

  const anchorByState = {
    'brewing-idle': interactiveByText('START SESSION'),
    'brewing-setup': interactiveByText('Confirm Setup'),
    'brewing-ready': byText('Ready'),
    'brewing-infusion': byText('Infusing'),
    'brewing-rest': byText('Rest'),
    'brewing-ended': interactiveByText('Start New Session'),
  };
  const anchor = anchorByState[captureName] || null;
  const page = anchor ? anchor.closest('.ion-page') : null;
  const content = page ? page.querySelector('ion-content') : null;
  const contentRoot = content && content.shadowRoot;
  const stack = anchor ? anchor.closest('.mx-auto') : null;
  const shell = stack ? stack.parentElement : null;
  const sections = stack ? Array.from(stack.children).filter((element) => element.tagName === 'SECTION') : [];
  const nodes = [];
  const requiredLabels = [];
  const observedCounts = { sections: sections.length };
  const expectedCounts = {
    sections: captureName === 'brewing-idle' ? 0 : captureName === 'brewing-setup' ? 3 : 4,
    tabs: 3,
  };
  const add = (label, element, required) => {
    nodes.push(describe(label, element));
    if (required) requiredLabels.push(label);
  };
  add('html', document.documentElement, true);
  add('body', document.body, true);
  add('page', page, true);
  add('content', content, true);
  add('content-background', contentRoot ? contentRoot.querySelector('[part="background"]') : null, true);
  add('content-scroll', contentRoot ? contentRoot.querySelector('[part="scroll"]') : null, true);
  add('page-shell', shell, true);
  add('stack', stack, true);
  add('state-anchor', anchor, true);

  const addIonButton = (prefix, button, required) => {
    const root = button && button.shadowRoot;
    add(prefix + '-host', button, required);
    add(prefix + '-native', root ? root.querySelector('[part="native"]') : null, required);
    add(prefix + '-inner', root ? root.querySelector('.button-inner') : null, required);
  };

  if (captureName === 'brewing-idle') {
    add('idle-hero-button', interactiveByText('START SESSION', stack), true);
  } else if (captureName === 'brewing-setup') {
    const weightPanel = sections[0] || null;
    const fieldsPanel = sections[1] || null;
    const actionRow = sections[2] || null;
    const fieldGrid = fieldsPanel ? fieldsPanel.firstElementChild : null;
    const fieldButtons = fieldGrid ? Array.from(fieldGrid.children).filter((element) => element.tagName === 'BUTTON') : [];
    const actionButtons = actionRow ? Array.from(actionRow.querySelectorAll(':scope > ion-button')) : [];
    observedCounts.setupFields = fieldButtons.length;
    observedCounts.setupActions = actionButtons.length;
    expectedCounts.setupFields = 5;
    expectedCounts.setupActions = 2;
    add('setup-weight-panel', weightPanel, true);
    add('setup-eyebrow', weightPanel ? weightPanel.firstElementChild : null, true);
    add('setup-current-weight', weightPanel ? weightPanel.children[1] : null, true);
    add('setup-fields-panel', fieldsPanel, true);
    add('setup-field-grid', fieldGrid, true);
    for (let index = 0; index < 5; index += 1) {
      const button = fieldButtons[index] || null;
      add('setup-field-' + index, button, true);
      add('setup-field-' + index + '-label', button ? button.firstElementChild : null, true);
      add('setup-field-' + index + '-value', button ? button.lastElementChild : null, true);
    }
    add('setup-action-row', actionRow, true);
    for (let index = 0; index < 2; index += 1) addIonButton('setup-action-' + index, actionButtons[index] || null, true);
  } else if (captureName === 'brewing-ready' || captureName === 'brewing-infusion' || captureName === 'brewing-rest') {
    const controlsPanel = sections[0] || null;
    const timerPanel = sections[1] || null;
    const fieldPanel = sections[2] || null;
    const actionRow = sections[3] || null;
    const timer = page ? page.querySelector('[data-testid="primary-timer"]') : null;
    const timerWell = timer ? timer.parentElement : null;
    const controlButtons = controlsPanel ? Array.from(controlsPanel.querySelectorAll(':scope > button')) : [];
    const fieldGrid = fieldPanel ? fieldPanel.firstElementChild : null;
    const fieldButtons = fieldGrid ? Array.from(fieldGrid.querySelectorAll(':scope > button')) : [];
    const actionButtons = actionRow ? Array.from(actionRow.querySelectorAll(':scope > ion-button')) : [];
    observedCounts.activeControls = controlButtons.length;
    observedCounts.activeFields = fieldButtons.length;
    observedCounts.activeActions = actionButtons.length;
    expectedCounts.activeControls = 4;
    expectedCounts.activeFields = 1;
    expectedCounts.activeActions = 2;
    add('active-controls-panel', controlsPanel, true);
    for (let index = 0; index < 4; index += 1) add('active-control-' + index, controlButtons[index] || null, true);
    add('active-timer-panel', timerPanel, true);
    add('active-phase-label', timerPanel ? timerPanel.firstElementChild : null, true);
    add('active-timer-well', timerWell, true);
    add('active-timer', timer, true);
    add('active-history-strip', page ? page.querySelector('[data-testid="infusion-history-strip"]') : null, captureName === 'brewing-rest');
    add('active-history-label', page ? page.querySelector('[data-testid="infusion-history-label"]') : null, captureName === 'brewing-rest');
    add('active-field-panel', fieldPanel, true);
    add('active-field-grid', fieldGrid, true);
    add('active-field-0', fieldButtons[0] || null, true);
    add('active-field-0-label', fieldButtons[0] ? fieldButtons[0].firstElementChild : null, true);
    add('active-field-0-value', fieldButtons[0] ? fieldButtons[0].lastElementChild : null, true);
    add('active-action-row', actionRow, true);
    for (let index = 0; index < 2; index += 1) addIonButton('active-action-' + index, actionButtons[index] || null, true);
  } else if (captureName === 'brewing-ended') {
    const summaryPanel = sections[0] || null;
    const setupPanel = sections[1] || null;
    const infusionsPanel = sections[2] || null;
    const actionRow = sections[3] || null;
    const summaryChildren = summaryPanel ? Array.from(summaryPanel.children) : [];
    const metricGrid = summaryPanel ? summaryPanel.querySelector(':scope > div.mt-3.grid') : null;
    const metricCards = metricGrid ? Array.from(metricGrid.children) : [];
    const actionButtons = actionRow ? Array.from(actionRow.querySelectorAll(':scope > ion-button')) : [];
    observedCounts.endedMetrics = metricCards.length;
    observedCounts.endedActions = actionButtons.length;
    expectedCounts.endedMetrics = 2;
    expectedCounts.endedActions = 2;
    add('ended-summary-panel', summaryPanel, true);
    add('ended-summary-eyebrow', summaryChildren[0] || null, true);
    add('ended-summary-title-control', summaryChildren[1] || null, true);
    add('ended-summary-title', summaryPanel ? summaryPanel.querySelector('h2') : null, true);
    add('ended-notes-wrapper', summaryChildren[2] || null, true);
    add('ended-notes-field', summaryChildren[2] ? summaryChildren[2].firstElementChild : null, true);
    add('ended-metric-grid', metricGrid, true);
    for (let index = 0; index < 2; index += 1) {
      const card = metricCards[index] || null;
      add('ended-metric-' + index, card, true);
      add('ended-metric-' + index + '-label', card ? card.firstElementChild : null, true);
      add('ended-metric-' + index + '-value', card ? card.lastElementChild : null, true);
    }
    add('ended-setup-panel', setupPanel, true);
    add('ended-setup-toggle', setupPanel ? setupPanel.querySelector('button[aria-label="Setup"]') : null, true);
    add('ended-setup-heading', setupPanel ? setupPanel.querySelector('[role="heading"]') : null, true);
    add('ended-setup-metric', setupPanel ? setupPanel.children[2] : null, true);
    add('ended-infusions-panel', infusionsPanel, true);
    add('ended-infusions-toggle', infusionsPanel ? infusionsPanel.querySelector('button[aria-label^="Infusions "]') : null, true);
    add('ended-infusions-heading', infusionsPanel ? infusionsPanel.querySelector('[role="heading"]') : null, true);
    add('ended-infusions-total', infusionsPanel ? byText('1 total', infusionsPanel) : null, true);
    add('ended-action-row', actionRow, true);
    for (let index = 0; index < 2; index += 1) addIonButton('ended-action-' + index, actionButtons[index] || null, true);
  }

  const tabBar = firstVisible('ion-tab-bar');
  add('tab-bar', tabBar, true);
  const tabs = Array.from(document.querySelectorAll('ion-tab-button')).filter(visible);
  observedCounts.tabs = tabs.length;
  for (let index = 0; index < 3; index += 1) {
    const tab = tabs[index] || null;
    const root = tab && tab.shadowRoot;
    const icon = tab ? tab.querySelector(':scope > ion-icon') : null;
    add('tab-' + index + '-button', tab, true);
    add('tab-' + index + '-native', root ? root.querySelector('[part="native"]') : null, true);
    add('tab-' + index + '-inner', root ? root.querySelector('.button-inner') : null, true);
    add('tab-' + index + '-icon', icon, true);
    add('tab-' + index + '-icon-svg', icon && icon.shadowRoot ? icon.shadowRoot.querySelector('svg') : null, false);
    add('tab-' + index + '-label', tab ? tab.querySelector(':scope > ion-label') : null, true);
  }

  const nodeByLabel = new Map(nodes.map((node) => [node.label, node]));
  const requiredNodes = requiredLabels.map((label) => nodeByLabel.get(label) || { label, missing: true });
  const rootStyle = getComputedStyle(document.documentElement);
  const safeAreaProbe = document.createElement('div');
  safeAreaProbe.style.cssText = 'position:fixed;visibility:hidden;padding-top:var(--ion-safe-area-top,0px);padding-right:var(--ion-safe-area-right,0px);padding-bottom:var(--ion-safe-area-bottom,0px);padding-left:var(--ion-safe-area-left,0px)';
  document.body.appendChild(safeAreaProbe);
  const safeAreaStyle = getComputedStyle(safeAreaProbe);
  const safeArea = {
    bottom: safeAreaStyle.paddingBottom, left: safeAreaStyle.paddingLeft,
    right: safeAreaStyle.paddingRight, top: safeAreaStyle.paddingTop,
  };
  safeAreaProbe.remove();

  return {
    captureName,
    coverage: {
      inspectedNodeCount: nodes.length,
      requiredLabels,
      countMismatches: Object.keys(expectedCounts).filter((key) => observedCounts[key] !== expectedCounts[key])
        .map((key) => ({ actual: observedCounts[key], expected: expectedCounts[key], label: key })),
      missingLabels: requiredNodes.filter((node) => node.missing).map((node) => node.label),
      notVisibleLabels: requiredNodes.filter((node) => !node.missing && !node.visible).map((node) => node.label),
      optionalMissingLabels: nodes.filter((node) => node.missing && requiredLabels.indexOf(node.label) < 0).map((node) => node.label),
    },
    fonts: {
      checks: {
        roboto300: document.fonts.check('300 16px Roboto'),
        roboto400: document.fonts.check('400 16px Roboto'),
        roboto500: document.fonts.check('500 16px Roboto'),
      },
      faces: Array.from(document.fonts).map((face) => ({ family: face.family, status: face.status, style: face.style, weight: face.weight }))
        .filter((face) => face.family.indexOf('Roboto') >= 0),
      rootFamily: rootStyle.fontFamily, status: document.fonts.status,
    },
    ionic: {
      documentClasses: document.documentElement.className,
      documentMode: document.documentElement.getAttribute('mode') || '',
      pageClasses: page ? page.className : '',
    },
    nodes,
    safeArea,
    structure: { expectedCounts, observedCounts },
    viewport: {
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      devicePixelRatio: window.devicePixelRatio,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      visualViewport: window.visualViewport ? {
        height: round(window.visualViewport.height), offsetLeft: round(window.visualViewport.offsetLeft),
        offsetTop: round(window.visualViewport.offsetTop), pageLeft: round(window.visualViewport.pageLeft),
        pageTop: round(window.visualViewport.pageTop), scale: round(window.visualViewport.scale),
        width: round(window.visualViewport.width),
      } : null,
    },
  };
})()`;
};
