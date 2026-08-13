const expression = `(() => {
  const styleProperties = [
    'display', 'position', 'boxSizing', 'width', 'height', 'minWidth', 'minHeight',
    'maxWidth', 'maxHeight', 'top', 'right', 'bottom', 'left',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'gap', 'rowGap', 'columnGap', 'alignItems', 'justifyContent',
    'flex', 'flexBasis', 'flexGrow', 'flexShrink', 'flexDirection',
    'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'lineHeight',
    'letterSpacing', 'textAlign', 'textTransform', 'whiteSpace',
    'color', 'background', 'backgroundColor',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
    'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
    'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
    'boxShadow', 'opacity', 'overflow', 'overflowX', 'overflowY', 'transform',
    'filter', 'backdropFilter', 'visibility', 'zIndex',
  ];
  const customProperties = [
    '--ion-font-family', '--ion-safe-area-top', '--ion-safe-area-right',
    '--ion-safe-area-bottom', '--ion-safe-area-left', '--ion-statusbar-padding',
  ];
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
  const describe = (label, element) => element ? {
    attributes: Array.from(element.attributes || []).reduce((result, attribute) => {
      if (['aria-hidden', 'aria-label', 'data-active', 'data-testid', 'role', 'style'].includes(attribute.name)) {
        result[attribute.name] = attribute.value;
      }
      return result;
    }, {}),
    box: { clientHeight: element.clientHeight, clientWidth: element.clientWidth, scrollHeight: element.scrollHeight, scrollWidth: element.scrollWidth },
    label, rect: rect(element), styles: styles(element), tag: element.tagName.toLowerCase(),
    text: (element.textContent || '').trim().replace(/\\s+/g, ' '), textRects: textRects(element),
    visible: visible(element),
  } : { label, missing: true };
  const byText = (root, text) => Array.from(root ? root.querySelectorAll('*') : [])
    .find((element) => visible(element) && (element.textContent || '').trim() === text) || null;

  const overlay = document.querySelector('[role="dialog"][aria-modal="true"]');
  const panel = overlay ? overlay.firstElementChild : null;
  const header = panel ? panel.firstElementChild : null;
  const track = panel ? panel.querySelector('[data-testid="tutorial-track"]') : null;
  const viewport = track ? track.parentElement : null;
  const activePage = track ? track.querySelector('section[data-active="true"]') : null;
  const previewPage = activePage ? activePage.nextElementSibling : null;
  const activeBody = activePage ? activePage.firstElementChild : null;
  const footer = panel ? panel.lastElementChild : null;
  const indicatorRow = footer ? footer.firstElementChild : null;
  const nav = footer ? footer.lastElementChild : null;
  const nodes = [
    describe('html', document.documentElement), describe('body', document.body),
    describe('overlay', overlay), describe('panel', panel), describe('header', header),
    describe('header-eyebrow', header ? header.querySelector('div > div') : null),
    describe('skip-button', header ? byText(header, 'Skip') : null),
    describe('viewport', viewport), describe('track', track), describe('active-page', activePage),
    describe('active-body', activeBody),
    describe('active-eyebrow', activeBody ? activeBody.firstElementChild : null),
    describe('active-title', document.getElementById('first-run-tutorial-title')),
    describe('active-description', activeBody ? activeBody.querySelector('p') : null),
    describe('preview-page', previewPage),
    describe('preview-body', previewPage ? previewPage.firstElementChild : null),
    describe('preview-title', previewPage ? previewPage.querySelector('h2') : null),
    describe('footer', footer), describe('indicator-row', indicatorRow), describe('nav', nav),
    describe('back-button', nav ? byText(nav, 'Back') : null),
    describe('next-button', nav ? byText(nav, 'Next') : null),
  ];
  Array.from(indicatorRow ? indicatorRow.children : []).forEach((indicator, index) => {
    nodes.push(describe('indicator-' + index, indicator));
  });
  Array.from(track ? track.querySelectorAll(':scope > section') : []).forEach((page, pageIndex) => {
    const body = page.firstElementChild;
    nodes.push(describe('page-' + pageIndex, page));
    nodes.push(describe('page-' + pageIndex + '-body', body));
    nodes.push(describe('page-' + pageIndex + '-eyebrow', body ? body.firstElementChild : null));
    nodes.push(describe('page-' + pageIndex + '-title', body ? body.querySelector('h2') : null));
    nodes.push(describe('page-' + pageIndex + '-description', body ? body.querySelector('p') : null));
    const list = body ? body.querySelector('ul') : null;
    if (list) {
      nodes.push(describe('page-' + pageIndex + '-list', list));
      Array.from(list.children).forEach((item, itemIndex) => {
        nodes.push(describe('page-' + pageIndex + '-list-item-' + itemIndex, item));
      });
    }
  });
  const rootStyle = getComputedStyle(document.documentElement);
  const safeAreaProbe = document.createElement('div');
  safeAreaProbe.style.cssText = 'position:fixed;visibility:hidden;padding-top:var(--ion-safe-area-top,0px);padding-right:var(--ion-safe-area-right,0px);padding-bottom:var(--ion-safe-area-bottom,0px);padding-left:var(--ion-safe-area-left,0px)';
  document.body.appendChild(safeAreaProbe);
  const safeAreaStyle = getComputedStyle(safeAreaProbe);
  const safeArea = { bottom: safeAreaStyle.paddingBottom, left: safeAreaStyle.paddingLeft,
    right: safeAreaStyle.paddingRight, top: safeAreaStyle.paddingTop };
  safeAreaProbe.remove();
  const viewportUnitProbe = document.createElement('div');
  viewportUnitProbe.style.cssText = 'position:fixed;visibility:hidden;height:52vh;width:52vw';
  const dynamicViewportUnitProbe = document.createElement('div');
  dynamicViewportUnitProbe.style.cssText = 'position:fixed;visibility:hidden;height:52dvh;width:52dvw';
  document.body.append(viewportUnitProbe, dynamicViewportUnitProbe);
  const viewportUnits = {
    dvh52: getComputedStyle(dynamicViewportUnitProbe).height,
    dvw52: getComputedStyle(dynamicViewportUnitProbe).width,
    vh52: getComputedStyle(viewportUnitProbe).height,
    vw52: getComputedStyle(viewportUnitProbe).width,
  };
  viewportUnitProbe.remove();
  dynamicViewportUnitProbe.remove();
  const coverage = {
    inspectedNodeCount: nodes.length,
    missingLabels: nodes.filter((node) => node.missing).map((node) => node.label),
    notVisibleLabels: nodes.filter((node) => !node.missing && !node.visible).map((node) => node.label),
  };
  return {
    coverage,
    fonts: {
      checks: { roboto300: document.fonts.check('300 16px Roboto'), roboto400: document.fonts.check('400 16px Roboto'), roboto500: document.fonts.check('500 16px Roboto') },
      faces: Array.from(document.fonts).map((face) => ({ family: face.family, status: face.status, style: face.style, weight: face.weight }))
        .filter((face) => face.family.indexOf('Roboto') >= 0),
      rootFamily: rootStyle.fontFamily, status: document.fonts.status,
    },
    ionic: { documentClasses: document.documentElement.className, documentMode: document.documentElement.getAttribute('mode') || '' },
    nodes, safeArea, viewportUnits,
    viewport: {
      clientHeight: document.documentElement.clientHeight, clientWidth: document.documentElement.clientWidth,
      devicePixelRatio: window.devicePixelRatio, innerHeight: window.innerHeight, innerWidth: window.innerWidth,
      screenAvailHeight: window.screen.availHeight, screenAvailWidth: window.screen.availWidth,
      screenHeight: window.screen.height, screenWidth: window.screen.width,
      visualViewport: window.visualViewport ? { height: round(window.visualViewport.height), offsetLeft: round(window.visualViewport.offsetLeft),
        offsetTop: round(window.visualViewport.offsetTop), pageLeft: round(window.visualViewport.pageLeft),
        pageTop: round(window.visualViewport.pageTop), scale: round(window.visualViewport.scale), width: round(window.visualViewport.width) } : null,
    },
  };
})()`;

export const TUTORIAL_DIAGNOSTICS_EXPRESSION = expression;
