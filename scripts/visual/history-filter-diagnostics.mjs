const expression = `(() => {
  const styleProperties = [
    'display', 'position', 'boxSizing', 'width', 'height', 'minWidth', 'minHeight',
    'maxWidth', 'maxHeight', 'top', 'right', 'bottom', 'left',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'gap', 'rowGap', 'columnGap', 'alignItems', 'justifyContent',
    'flex', 'flexBasis', 'flexGrow', 'flexShrink', 'gridTemplateColumns',
    'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'lineHeight',
    'letterSpacing', 'textAlign', 'whiteSpace', 'textOverflow',
    'color', 'background', 'backgroundColor',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
    'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
    'borderTopLeftRadius', 'borderTopRightRadius',
    'borderBottomRightRadius', 'borderBottomLeftRadius',
    'boxShadow', 'opacity', 'overflow', 'overflowX', 'overflowY',
    'transform', 'filter', 'backdropFilter', 'appearance',
  ];
  const customProperties = [
    '--ion-font-family', '--ion-safe-area-top', '--ion-safe-area-right',
    '--ion-safe-area-bottom', '--ion-safe-area-left', '--ion-statusbar-padding',
    '--background', '--border-radius', '--box-shadow', '--color', '--icon-color',
    '--placeholder-color', '--placeholder-opacity', '--padding-start', '--padding-end',
    '--inner-padding-start', '--inner-padding-end', '--border-color', '--border-width',
    '--inner-border-width', '--min-height', '--zen-autocomplete-background',
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
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  const firstVisible = (selector, root) => Array.from((root || document).querySelectorAll(selector)).find(visible) || null;
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
      if (ruleText.startsWith('@media')) {
        try { return window.matchMedia(condition).matches; } catch (error) { return false; }
      }
      if (ruleText.startsWith('@supports')) {
        try { return CSS.supports(condition); } catch (error) { return false; }
      }
      return true;
    };
    const walk = (rules, source) => {
      Array.from(rules || []).forEach((rule) => {
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
    };
    roots.forEach((root) => {
      Array.from(root.styleSheets || []).forEach((sheet, index) => {
        try { walk(sheet.cssRules, sheet.href || ('inline:' + index)); } catch (error) {
          matches.push({ error: String(error), source: sheet.href || ('inline:' + index) });
        }
      });
    });
    return matches;
  };
  const describe = (label, element) => {
    if (!element) return { label, missing: true };
    return {
      attributes: Array.from(element.attributes || []).reduce((result, attribute) => {
        result[attribute.name] = attribute.value;
        return result;
      }, {}),
      label,
      matchedDeclarations: matchingDeclarations(element),
      mode: element.mode || element.getAttribute('mode') || '',
      part: element.getAttribute('part') || '',
      rect: rect(element),
      styles: styles(element),
      tag: element.tagName.toLowerCase(),
      text: (element.textContent || '').trim().replace(/\\s+/g, ' '),
      textRects: textRects(element),
    };
  };

  const surface = firstVisible('[data-testid="history-header-surface"]');
  const searchbar = surface ? firstVisible('ion-searchbar', surface) : null;
  const searchRoot = searchbar && (searchbar.shadowRoot || searchbar);
  const fields = surface ? firstVisible('.zen-history-filter-fields', surface) : null;
  const nodes = [
    describe('html', document.documentElement),
    describe('body', document.body),
    describe('history-header', surface ? surface.closest('ion-header') : null),
    describe('header-frame', surface ? surface.parentElement : null),
    describe('header-surface', surface),
    describe('filter-deck', surface ? firstVisible('.zen-history-filter-deck', surface) : null),
    describe('filter-row', surface ? firstVisible('[data-testid="history-filter-row"]', surface) : null),
    describe('searchbar-host', searchbar),
    describe('searchbar-container', searchRoot ? searchRoot.querySelector('.searchbar-input-container') : null),
    describe('searchbar-input', searchRoot ? searchRoot.querySelector('.searchbar-input') : null),
    describe('searchbar-icon', searchRoot ? searchRoot.querySelector('.searchbar-search-icon') : null),
    describe('filter-toggle', surface ? firstVisible('[aria-label^="Hide history filters"]', surface) : null),
    describe('statistics-button', surface ? firstVisible('[aria-label="Open tea statistics"]', surface) : null),
    describe('filter-fields', fields),
    describe('history-content', firstVisible('[data-testid="history-page"]')),
    describe('history-list', firstVisible('.zen-list-surface')),
    describe('first-history-item', firstVisible('ion-item-sliding ion-item')),
    describe('tab-bar', firstVisible('ion-tab-bar')),
    describe('history-tab', firstVisible('ion-tab-button[tab="history"]')),
  ];

  if (fields) {
    Array.from(fields.querySelectorAll(':scope > label')).forEach((label, index) => {
      const input = label.querySelector('input');
      const button = label.querySelector('button');
      nodes.push(describe('filter-label-' + index, label));
      nodes.push(describe('filter-input-' + index, input));
      nodes.push(describe('filter-suggestion-button-' + index, button));
      nodes.push(describe('filter-suggestion-icon-' + index, button ? button.querySelector('span') : null));
    });
  }

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
    fonts: {
      checks: {
        roboto300: document.fonts.check('300 16px Roboto'),
        roboto400: document.fonts.check('400 16px Roboto'),
        roboto500: document.fonts.check('500 16px Roboto'),
      },
      faces: Array.from(document.fonts).map((face) => ({
        family: face.family, status: face.status, style: face.style, weight: face.weight,
      })).filter((face) => face.family.indexOf('Roboto') >= 0),
      rootFamily: rootStyle.fontFamily,
      status: document.fonts.status,
    },
    ionic: {
      documentClasses: document.documentElement.className,
      documentMode: document.documentElement.getAttribute('mode') || '',
      searchbarClasses: searchbar ? searchbar.className : '',
      searchbarMode: searchbar ? (searchbar.mode || searchbar.getAttribute('mode') || '') : '',
    },
    nodes,
    safeArea,
    viewport: {
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      devicePixelRatio: window.devicePixelRatio,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      screenHeight: window.screen.height,
      screenWidth: window.screen.width,
      visualViewport: window.visualViewport ? {
        height: round(window.visualViewport.height), offsetLeft: round(window.visualViewport.offsetLeft),
        offsetTop: round(window.visualViewport.offsetTop), pageLeft: round(window.visualViewport.pageLeft),
        pageTop: round(window.visualViewport.pageTop), scale: round(window.visualViewport.scale),
        width: round(window.visualViewport.width),
      } : null,
    },
  };
})()`;

export const HISTORY_FILTER_DIAGNOSTICS_EXPRESSION = expression;
