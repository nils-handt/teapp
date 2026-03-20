// Mocks for Stencil and JSDOM environment compatibility
// These must run BEFORE any imports that might trigger Stencil initialization

// see https://github.com/jsdom/jsdom/issues/3998, might be fixed in @stencil/core@4.40.1
if (typeof document !== 'undefined' && !document.adoptedStyleSheets) {
    Object.defineProperty(document, 'adoptedStyleSheets', {
        writable: true,
        configurable: true,
        value: [],
    });
}
// see https://github.com/jsdom/jsdom/issues/3998, might be fixed in @stencil/core@4.40.1
if (typeof ShadowRoot !== 'undefined') {
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
        get() {
            if (!this._adoptedStyleSheets) {
                this._adoptedStyleSheets = [];
            }
            return this._adoptedStyleSheets;
        },
        set(value) {
            this._adoptedStyleSheets = value;
        },
        configurable: true,
    });
}
