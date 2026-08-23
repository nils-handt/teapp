import { describe, expect, it, vi } from 'vitest';
import { nativeAppRootUrl, reloadAfterRestore } from './reloadAfterRestore';

describe('reloadAfterRestore', () => {
    it('returns native navigation to the origin root', () => {
        const location = {
            origin: 'https://localhost',
            reload: vi.fn(),
            replace: vi.fn(),
        };

        reloadAfterRestore({ isNative: true, location });

        expect(location.replace).toHaveBeenCalledWith('https://localhost/');
        expect(location.reload).not.toHaveBeenCalled();
    });

    it('reloads the current web hash route', () => {
        const location = {
            origin: 'https://example.test',
            reload: vi.fn(),
            replace: vi.fn(),
        };

        reloadAfterRestore({ isNative: false, location });

        expect(location.reload).toHaveBeenCalledOnce();
        expect(location.replace).not.toHaveBeenCalled();
    });
});

describe('nativeAppRootUrl', () => {
    it('normalizes origins to an absolute root URL', () => {
        expect(nativeAppRootUrl('https://localhost')).toBe('https://localhost/');
    });
});
