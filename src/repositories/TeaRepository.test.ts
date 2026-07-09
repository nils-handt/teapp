import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tea } from '../entities/Tea.entity';
import { teaRepository } from './TeaRepository';

vi.mock('../database/dataSource', () => ({
    AppDataSource: {
        getRepository: vi.fn().mockReturnValue({
            extend: vi.fn((customMethods) => ({
                ...customMethods,
                find: vi.fn(),
                findOne: vi.fn(),
                save: vi.fn(),
            })),
        }),
    },
}));

describe('TeaRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('saves teas with numeric years', async () => {
        const tea = Object.assign(new Tea(), {
            teaId: 'tea-1',
            name: 'Longjing',
            brand: 'Lipton',
            type: 'Green Tea',
            subtype: null,
            region: null,
            subregion: null,
            year: 2020,
            season: null,
        });
        const saveSpy = vi.fn().mockResolvedValue(tea);
        teaRepository.save = saveSpy;

        const result = await teaRepository.saveTea(tea);

        expect(saveSpy).toHaveBeenCalledWith(tea);
        expect(result.year).toBe(2020);
    });

    it('loads teas ordered by name', async () => {
        const teas = [new Tea()];
        const findSpy = vi.fn().mockResolvedValue(teas);
        teaRepository.find = findSpy;

        const result = await teaRepository.getAllTeas();

        expect(findSpy).toHaveBeenCalledWith({ order: { name: 'ASC' } });
        expect(result).toBe(teas);
    });

    it('returns a tea by id', async () => {
        const tea = new Tea();
        const findOneSpy = vi.fn().mockResolvedValue(tea);
        teaRepository.findOne = findOneSpy;

        const result = await teaRepository.getTeaById('tea-1');

        expect(findOneSpy).toHaveBeenCalledWith({ where: { teaId: 'tea-1' } });
        expect(result).toBe(tea);
    });
});
