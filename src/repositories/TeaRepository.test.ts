import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tea } from '../entities/Tea.entity';
import { teaRepository } from './TeaRepository';

const repositoryMocks = vi.hoisted(() => ({
    save: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
}));

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
        transaction: repositoryMocks.transaction,
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

    it('updates a shared tea and only linked session labels in one transaction', async () => {
        const tea = Object.assign(new Tea(), {
            teaId: 'tea-1',
            name: 'Longjing',
            brand: 'Tea House',
            type: 'Green',
            subtype: null,
            region: null,
            subregion: null,
            year: 2024,
            season: null,
        });
        repositoryMocks.save.mockResolvedValue(tea);
        repositoryMocks.update.mockResolvedValue({ affected: 2 });
        repositoryMocks.transaction.mockImplementation(async (work) => work({
            getRepository: vi.fn()
                .mockReturnValueOnce({ save: repositoryMocks.save })
                .mockReturnValueOnce({ update: repositoryMocks.update }),
        }));

        const result = await teaRepository.updateSharedTea(tea);

        expect(repositoryMocks.transaction).toHaveBeenCalledTimes(1);
        expect(repositoryMocks.save).toHaveBeenCalledWith(tea);
        expect(repositoryMocks.update).toHaveBeenCalledWith(
            { teaId: 'tea-1' },
            { teaName: '2024 Longjing Tea House Green' },
        );
        expect(result).toBe(tea);
    });
});
