// Mocks for Stencil and JSDOM environment compatibility
// These must run BEFORE any imports that might trigger Stencil initialization

// Mock Stencil BUILD object
(window as any).__STENCIL_BUILD__ = {
    isDev: true,
    isTesting: true,
    isServer: false,
    isBrowser: true,
};

// Mock CSSStyleSheet and adoptedStyleSheets if missing (fix for Stencil in JSDOM)
if (typeof CSSStyleSheet === 'undefined') {
    (window as any).CSSStyleSheet = class {
        replaceSync() { }
    };
}

if (typeof document.adoptedStyleSheets === 'undefined') {
    Object.defineProperty(document, 'adoptedStyleSheets', {
        writable: true,
        value: [],
    });
}

// Ensure specific behavior for Stencil check:
// Object.getOwnPropertyDescriptor(win.document.adoptedStyleSheets, "length").writable
try {
    const adoptedSheets = document.adoptedStyleSheets;
    if (Array.isArray(adoptedSheets)) {
        const desc = Object.getOwnPropertyDescriptor(adoptedSheets, 'length');
        if (!desc || desc.configurable) {
            Object.defineProperty(adoptedSheets, 'length', {
                writable: true,
                value: 0,
                configurable: true,
                enumerable: false
            });
        }
    }
} catch (e) {
    console.warn('Failed to mock adoptedStyleSheets.length:', e);
}

// Mock ResizeObserver
const ResizeObserverMock = class {
    observe() { }
    unobserve() { }
    disconnect() { }
};
window.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver
const IntersectionObserverMock = class {
    observe() { }
    unobserve() { }
    disconnect() { }
};
window.IntersectionObserver = IntersectionObserverMock as any;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: any) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { }, // deprecated
        removeListener: () => { }, // deprecated
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => { },
    }),
});
