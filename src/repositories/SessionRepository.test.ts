import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Like } from 'typeorm';
import { sessionRepository } from './SessionRepository';
import { BrewingSession } from '../entities/BrewingSession.entity';

// Mock the AppDataSource to avoid actual DB connection
vi.mock('../database/dataSource', () => ({
    AppDataSource: {
        getRepository: vi.fn().mockReturnValue({
            extend: vi.fn((customMethods) => ({
                ...customMethods,
                find: vi.fn(),
                findOne: vi.fn(),
                save: vi.fn(),
                delete: vi.fn(),
            })),
        }),
    },
}));

describe('SessionRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getAllSessions should return sessions ordered by startTime DESC', async () => {
        const mockSessions = [new BrewingSession(), new BrewingSession()];
        // We need to spy on the 'find' method which is part of the repository instance
        // Since we can't easily access the internal mock from here without complex setup,
        // we will rely on the fact that sessionRepository IS the extended object.

        // However, since we are mocking the module that CREATES sessionRepository, 
        // strictly speaking sessionRepository here is the result of the mock factory.
        // Let's spy on the methods directly attached to the exported object.

        // Actually, because we mocked the DataSource returned value, sessionRepository
        // should have the methods we defined in the 'extend' call + the mocked base methods.

        // Let's just mock the implementation of 'find' on the sessionRepository object itself
        // if it exists, or assume the mock factory setup worked.

        // A better approach for testing extensions like this without spinning up a DB
        // is often to just verify the *arguments* passed to the base methods.

        const findSpy = vi.fn().mockResolvedValue(mockSessions);
        sessionRepository.find = findSpy;

        const result = await sessionRepository.getAllSessions();

        expect(findSpy).toHaveBeenCalledWith({
            order: { startTime: 'DESC' },
            relations: ['infusions', 'brewingVessel'],
        });
        expect(result).toBe(mockSessions);
    });

    it('getActiveSession should return the newest active session with infusions', async () => {
        const mockSession = new BrewingSession();
        const findOneSpy = vi.fn().mockResolvedValue(mockSession);
        sessionRepository.findOne = findOneSpy;

        const result = await sessionRepository.getActiveSession();

        expect(findOneSpy).toHaveBeenCalledWith({
            where: { status: 'active' },
            order: { startTime: 'DESC' },
            relations: ['infusions', 'brewingVessel'],
        });
        expect(result).toBe(mockSession);
    });

    it('getSessionById should return a session with infusions', async () => {
        const mockSession = new BrewingSession();
        const findOneSpy = vi.fn().mockResolvedValue(mockSession);
        sessionRepository.findOne = findOneSpy;

        const result = await sessionRepository.getSessionById('123');

        expect(findOneSpy).toHaveBeenCalledWith({
            where: { sessionId: '123' },
            relations: ['infusions', 'brewingVessel'],
        });
        expect(result).toBe(mockSession);
    });

    it('getSessionsByTeaName should filter by tea name', async () => {
        const mockSessions = [new BrewingSession()];
        const findSpy = vi.fn().mockResolvedValue(mockSessions);
        sessionRepository.find = findSpy;

        const result = await sessionRepository.getSessionsByTeaName('Oolong');

        expect(findSpy).toHaveBeenCalledWith({
            where: { teaName: Like('%Oolong%') },
            order: { startTime: 'DESC' },
            relations: ['infusions', 'brewingVessel'],
        });
        expect(result).toBe(mockSessions);
    });

    it('deleteSession should delete the session', async () => {
        const deleteSpy = vi.fn().mockResolvedValue({ affected: 1 });
        sessionRepository.delete = deleteSpy;

        await sessionRepository.deleteSession('123');

        expect(deleteSpy).toHaveBeenCalledWith('123');
    });
});
