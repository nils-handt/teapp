export const MODAL_DIAGNOSTICS_EXPRESSION = `(() => {
  const visible = (element) => {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const rect = (element) => {
    if (!element) return null;
    const value = element.getBoundingClientRect();
    return {
      bottom: value.bottom,
      height: value.height,
      left: value.left,
      right: value.right,
      top: value.top,
      width: value.width,
    };
  };
  const describe = (element) => {
    if (!element) return null;
    const style = getComputedStyle(element);
    const bounds = rect(element);
    return {
      ariaLabel: element.getAttribute('aria-label'),
      clientHeight: element.clientHeight,
      rect: bounds,
      scrollHeight: element.scrollHeight,
      text: (element.textContent || '').trim().replace(/\\s+/g, ' '),
      visible: visible(element),
      withinLayoutViewport: bounds.top >= 0 && bounds.bottom <= window.innerHeight,
      styles: {
        display: style.display,
        flex: style.flex,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        overflowY: style.overflowY,
        paddingBottom: style.paddingBottom,
        paddingTop: style.paddingTop,
      },
    };
  };

  const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(visible) || null;
  const panel = dialog ? dialog.firstElementChild : null;
  const title = panel ? panel.querySelector('h1, h2, h3, [id]') : null;
  const input = panel ? Array.from(panel.querySelectorAll('input, textarea')).find(visible) || null : null;
  const actions = panel ? panel.lastElementChild : null;
  const body = input ? input.closest('.overflow-y-auto') : null;
  const buttons = panel ? Array.from(panel.querySelectorAll('button')).filter(visible).map(describe) : [];
  const required = { dialog, panel, title, body, input, actions };

  return {
    coverage: {
      missingLabels: Object.entries(required).filter(([, element]) => !element).map(([label]) => label),
      notVisibleLabels: Object.entries(required).filter(([, element]) => element && !visible(element)).map(([label]) => label),
    },
    keyboard: {
      activeElement: document.activeElement && document.activeElement.getAttribute
        ? (document.activeElement.getAttribute('aria-label') || document.activeElement.tagName)
        : null,
      cssInset: dialog ? getComputedStyle(dialog).getPropertyValue('--modal-keyboard-height').trim() : null,
      open: dialog ? dialog.getAttribute('data-keyboard-open') : null,
    },
    nodes: {
      actions: describe(actions),
      body: describe(body),
      buttons,
      dialog: describe(dialog),
      input: describe(input),
      panel: describe(panel),
      title: describe(title),
    },
    viewport: {
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      visual: window.visualViewport ? {
        height: window.visualViewport.height,
        offsetLeft: window.visualViewport.offsetLeft,
        offsetTop: window.visualViewport.offsetTop,
        width: window.visualViewport.width,
      } : null,
    },
  };
})()`;
