import { describe, expect, it, vi } from 'vitest';
import { createUuid } from './createUuid';

describe('createUuid', () => {
    it('uses the platform UUID implementation when available', () => {
        const randomUUID = vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');

        try {
            expect(createUuid()).toBe('11111111-1111-4111-8111-111111111111');
            expect(randomUUID).toHaveBeenCalledOnce();
        } finally {
            randomUUID.mockRestore();
        }
    });

    it('creates an RFC 4122 version 4 UUID when randomUUID is unavailable', () => {
        const originalDescriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
        Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });

        try {
            expect(createUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        } finally {
            if (originalDescriptor) {
                Object.defineProperty(crypto, 'randomUUID', originalDescriptor);
            } else {
                delete (crypto as Partial<Crypto>).randomUUID;
            }
        }
    });
});
