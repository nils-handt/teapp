const expression = `(() => {
  const styleProperties = [
    'display', 'position', 'boxSizing', 'width', 'height', 'minWidth', 'minHeight',
    'maxWidth', 'maxHeight', 'top', 'right', 'bottom', 'left',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'marginInlineStart', 'marginInlineEnd',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'paddingInlineStart', 'paddingInlineEnd',
    'gap', 'rowGap', 'columnGap', 'alignItems', 'justifyContent',
    'flex', 'flexBasis', 'flexGrow', 'flexShrink', 'gridTemplateColumns',
    'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'lineHeight',
    'letterSpacing', 'textAlign', 'textTransform', 'verticalAlign', 'whiteSpace', 'textOverflow',
    'color', 'background', 'backgroundColor',
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
    '--background', '--background-activated', '--background-hover', '--border-radius',
    '--box-shadow', '--color', '--padding-start', '--padding-end', '--padding-top',
    '--padding-bottom', '--inner-padding-start', '--inner-padding-end', '--border-color',
    '--border-width', '--inner-border-width', '--min-height', '--offset-top', '--offset-bottom',
    '--track-background', '--track-background-checked', '--handle-background',
    '--handle-background-checked', '--handle-height', '--handle-width', '--handle-spacing',
    '--placeholder-color', '--icon-color', '--ion-color-base', '--ion-color-primary',
    '--ion-color-medium',
  ];
  const relevantDeclarations = new Set(styleProperties.map((property) =>
    property.replace(/[A-Z]/g, (match) => '-' + match.toLowerCase())).concat(customProperties));
  const round = (value) => Math.round(value * 1000) / 1000;
  const rect = (element) => {
    const value = element.getBoundingClientRect();
    return { bottom: round(value.bottom), height: round(value.height), left: round(value.left),
      right: round(value.right), top: round(value.top), width: round(value.width),
      x: round(value.x), y: round(value.y) };
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
    .filter((element) => visible(element) && (element.textContent || '').trim() === text)
    .sort((left, right) => left.querySelectorAll('*').length - right.querySelectorAll('*').length)[0] || null;
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
    const walk = (rules, source) => Array.from(rules || []).forEach((rule) => {
      if (rule.cssRules && rule.cssRules.length > 0) {
        let active = true;
        const text = (rule.cssText || '').trim();
        const condition = rule.conditionText || (rule.media && rule.media.mediaText) || '';
        if (text.indexOf('@media') === 0) {
          try { active = matchMedia(condition).matches; } catch (error) { active = false; }
        } else if (text.indexOf('@supports') === 0) {
          try { active = CSS.supports(condition); } catch (error) { active = false; }
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
    attributes: Array.from(element.attributes || []).reduce((result, attribute) => {
      result[attribute.name] = attribute.value;
      return result;
    }, {}),
    label, matchedDeclarations: matchingDeclarations(element),
    mode: element.mode || element.getAttribute('mode') || '', part: element.getAttribute('part') || '',
    rect: rect(element), styles: styles(element), tag: element.tagName.toLowerCase(),
    text: (element.textContent || '').trim().replace(/\\s+/g, ' '),
    textRects: textRects(element), visible: visible(element),
  } : { label, missing: true };
  const describeItem = (nodes, label, item) => {
    const root = item && item.shadowRoot;
    nodes.push(describe(label + '-host', item));
    nodes.push(describe(label + '-native', root ? root.querySelector('[part="native"]') : null));
    nodes.push(describe(label + '-inner', root ? root.querySelector('.item-inner') : null));
    nodes.push(describe(label + '-input-wrapper', root ? root.querySelector('.input-wrapper') : null));
  };
  const describeTabs = (nodes) => {
    const tabs = Array.from(document.querySelectorAll('ion-tab-button')).filter(visible);
    nodes.push(describe('tab-bar', firstVisible('ion-tab-bar')));
    [0, 1, 2].forEach((index) => {
      const tab = tabs[index];
      const root = tab && tab.shadowRoot;
      const icon = tab ? tab.querySelector(':scope > ion-icon') : null;
      const iconRoot = icon && icon.shadowRoot;
      nodes.push(describe('tab-' + index + '-button', tab));
      nodes.push(describe('tab-' + index + '-native', root ? root.querySelector('[part="native"]') : null));
      nodes.push(describe('tab-' + index + '-icon', icon));
      nodes.push(describe('tab-' + index + '-icon-svg', iconRoot ? iconRoot.querySelector('svg') : null));
      nodes.push(describe('tab-' + index + '-label', tab ? tab.querySelector(':scope > ion-label') : null));
    });
  };
  const common = (nodes, expectedNodeCount) => {
    const rootStyle = getComputedStyle(document.documentElement);
    const coverage = {
      inspectedNodeCount: nodes.length,
      expectedNodeCount,
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
        safeArea: { top: rootStyle.getPropertyValue('--ion-safe-area-top').trim(), right: rootStyle.getPropertyValue('--ion-safe-area-right').trim(),
          bottom: rootStyle.getPropertyValue('--ion-safe-area-bottom').trim(), left: rootStyle.getPropertyValue('--ion-safe-area-left').trim() },
        visualViewport: window.visualViewport ? { height: round(window.visualViewport.height), width: round(window.visualViewport.width), scale: round(window.visualViewport.scale) } : null },
    };
  };

  const settingsPage = firstVisible('[data-testid="settings-page"]');
  if (settingsPage) {
    const page = settingsPage.closest('.ion-page');
    const contentRoot = settingsPage.shadowRoot;
    const lists = Array.from(settingsPage.querySelectorAll('ion-list.zen-list-surface'));
    const tutorialText = byText('Show Tutorial', settingsPage) || byText('Show Tutorial Again', settingsPage);
    const installHeader = byText('App Installation', settingsPage);
    const installTitle = byText('Install Teapp', settingsPage);
    const installCopy = byText('Use your browser menu to install Teapp when installation is available.', settingsPage);
    const bluetoothHeader = byText('Bluetooth Scale', settingsPage);
    const statusTitle = byText('Status', settingsPage);
    const connected = byText('connected', settingsPage);
    const mockActive = byText('Mock Mode Active', settingsPage);
    const deviceTitle = byText('Connected Device', settingsPage);
    const deviceName = byText('Mock Scale', settingsPage);
    const deviceId = byText('mock-device-id', settingsPage);
    const disconnect = firstVisible('ion-button[data-zen-variant="danger"]', settingsPage);
    const disconnectRoot = disconnect && disconnect.shadowRoot;
    const developmentHeader = byText('Development', settingsPage);
    const devMode = byText('Dev Mode', settingsPage);
    const mockScale = byText('Use Mock Scale', settingsPage);
    const logLevel = byText('Log Level', settingsPage);
    const devToggle = devMode ? devMode.closest('ion-item').querySelector('ion-toggle') : null;
    const mockToggle = mockScale ? mockScale.closest('ion-item').querySelector('ion-toggle') : null;
    const select = logLevel ? logLevel.closest('ion-item').querySelector('ion-select') : null;
    const selectRoot = select && select.shadowRoot;
    const debug = selectRoot ? selectRoot.querySelector('.select-text') : null;
    const nodes = [
      describe('html', document.documentElement), describe('body', document.body), describe('settings-page', page),
      describe('settings-content', settingsPage),
      describe('settings-content-background', contentRoot ? contentRoot.querySelector('[part="background"]') : null),
      describe('settings-content-scroll', contentRoot ? contentRoot.querySelector('[part="scroll"]') : null),
      describe('tutorial-list', lists[0]), describe('tutorial-label', tutorialText),
      describe('install-list', lists[1]), describe('install-header', installHeader ? installHeader.closest('ion-list-header') : null),
      describe('install-header-label', installHeader), describe('install-title', installTitle), describe('install-copy', installCopy),
      describe('bluetooth-list', lists[2]), describe('bluetooth-header', bluetoothHeader ? bluetoothHeader.closest('ion-list-header') : null),
      describe('bluetooth-header-label', bluetoothHeader), describe('status-title', statusTitle), describe('status-value', connected),
      describe('status-mock-active', mockActive), describe('device-title', deviceTitle), describe('device-name', deviceName),
      describe('device-id', deviceId), describe('disconnect-button', disconnect),
      describe('disconnect-native', disconnectRoot ? disconnectRoot.querySelector('[part="native"]') : null),
      describe('disconnect-inner', disconnectRoot ? disconnectRoot.querySelector('.button-inner') : null),
      describe('development-list', lists[3]),
      describe('development-header', developmentHeader ? developmentHeader.closest('ion-list-header') : null),
      describe('development-header-label', developmentHeader), describe('dev-mode-label', devMode),
      describe('mock-scale-label', mockScale), describe('log-level-label', logLevel), describe('log-level-value', debug),
    ];
    describeItem(nodes, 'tutorial-item', tutorialText ? tutorialText.closest('ion-item') : null);
    describeItem(nodes, 'install-item', installTitle ? installTitle.closest('ion-item') : null);
    describeItem(nodes, 'status-item', statusTitle ? statusTitle.closest('ion-item') : null);
    describeItem(nodes, 'device-item', deviceTitle ? deviceTitle.closest('ion-item') : null);
    describeItem(nodes, 'dev-mode-item', devMode ? devMode.closest('ion-item') : null);
    describeItem(nodes, 'mock-scale-item', mockScale ? mockScale.closest('ion-item') : null);
    describeItem(nodes, 'log-level-item', logLevel ? logLevel.closest('ion-item') : null);
    [devToggle, mockToggle].forEach((toggle, index) => {
      const root = toggle && toggle.shadowRoot;
      nodes.push(describe('toggle-' + index + '-host', toggle));
      nodes.push(describe('toggle-' + index + '-track', root ? root.querySelector('[part="track"]') : null));
      nodes.push(describe('toggle-' + index + '-handle', root ? root.querySelector('[part="handle"]') : null));
    });
    nodes.push(describe('log-level-select', select));
    nodes.push(describe('log-level-select-wrapper', selectRoot ? selectRoot.querySelector('.select-wrapper') : null));
    nodes.push(describe('log-level-select-text', selectRoot ? selectRoot.querySelector('.select-text') : null));
    nodes.push(describe('log-level-select-icon', selectRoot ? selectRoot.querySelector('.select-icon') : null));
    describeTabs(nodes);
    return common(nodes, 86);
  }

  const sessionTitle = firstVisible('[data-testid="history-header-title"]');
  const sessionPage = sessionTitle ? sessionTitle.closest('.ion-page') : null;
  const content = sessionPage ? firstVisible('ion-content', sessionPage) : null;
  const contentRoot = content && content.shadowRoot;
  const shell = content ? content.querySelector(':scope > div') : null;
  const stack = shell ? shell.firstElementChild : null;
  const sections = stack ? Array.from(stack.children).filter((element) => element.tagName === 'SECTION') : [];
  const summary = sections[0];
  const setup = sections[1];
  const headerSurface = sessionPage ? sessionPage.querySelector('[data-testid="history-header-surface"]') : null;
  const back = headerSurface ? headerSurface.querySelector('[aria-label="Back"]') : null;
  const backRoot = back && back.shadowRoot;
  const eyebrow = headerSurface ? byText('Session overview', headerSurface) : null;
  const summaryEyebrow = summary ? byText('Session Summary', summary) : null;
  const titleButton = summary ? firstVisible('button', summary) : null;
  const summaryTitle = titleButton ? titleButton.querySelector('h2') : null;
  const notesLabel = summary ? byText('Notes', summary) : null;
  const notesField = notesLabel ? notesLabel.closest('.zen-field-button') : null;
  const notesValue = summary ? byText('No notes', summary) : null;
  const waterLabel = summary ? byText('Water amount', summary) : null;
  const waterCard = waterLabel ? waterLabel.parentElement : null;
  const waterValue = summary ? byText('468.4 g', summary) : null;
  const durationLabel = summary ? byText('Infusion duration', summary) : null;
  const durationCard = durationLabel ? durationLabel.parentElement : null;
  const durationValue = summary ? byText('7:53', summary) : null;
  const setupHeading = setup ? byText('Setup', setup) : null;
  const teaLabel = setup ? byText('Tea', setup) : null;
  const teaCard = teaLabel ? teaLabel.parentElement : null;
  const nodes = [
    describe('html', document.documentElement), describe('body', document.body), describe('session-page', sessionPage),
    describe('session-header', sessionPage ? sessionPage.querySelector('ion-header') : null),
    describe('header-frame', headerSurface ? headerSurface.parentElement : null), describe('header-surface', headerSurface),
    describe('header-title-row', headerSurface ? headerSurface.firstElementChild : null),
    describe('header-back-wrap', back ? back.parentElement : null), describe('header-back-button', back),
    describe('header-back-native', backRoot ? backRoot.querySelector('[part="native"]') : null),
    describe('header-back-inner', backRoot ? backRoot.querySelector('.button-inner') : null),
    describe('header-eyebrow', eyebrow), describe('header-title', sessionTitle), describe('session-content', content),
    describe('session-content-background', contentRoot ? contentRoot.querySelector('[part="background"]') : null),
    describe('session-content-scroll', contentRoot ? contentRoot.querySelector('[part="scroll"]') : null),
    describe('page-shell', shell), describe('stack', stack), describe('summary-panel', summary),
    describe('summary-eyebrow', summaryEyebrow), describe('summary-title-button', titleButton), describe('summary-title', summaryTitle),
    describe('notes-field', notesField), describe('notes-label', notesLabel), describe('notes-value', notesValue),
    describe('metric-grid', waterCard ? waterCard.parentElement : null), describe('water-card', waterCard),
    describe('water-label', waterLabel), describe('water-value', waterValue), describe('duration-card', durationCard),
    describe('duration-label', durationLabel), describe('duration-value', durationValue), describe('setup-panel', setup),
    describe('setup-heading-row', setupHeading ? setupHeading.parentElement : null), describe('setup-heading', setupHeading),
    describe('tea-card', teaCard), describe('tea-label', teaLabel),
  ];
  describeTabs(nodes);
  return common(nodes, 53);
})()`;

export const SETTINGS_SESSION_DIAGNOSTICS_EXPRESSION = expression;
