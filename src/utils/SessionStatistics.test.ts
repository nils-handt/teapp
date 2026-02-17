import { describe, it, expect } from 'vitest';
import { calculateSessionStats } from './SessionStatistics';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Infusion } from '../entities/Infusion.entity';

describe('SessionStatistics', () => {
    it('should return zero stats for session with no infusions', () => {
        const session = new BrewingSession();
        session.infusions = [];

        const stats = calculateSessionStats(session);

        expect(stats).toEqual({
            totalInfusions: 0,
            totalBrewTime: 0,
            averageInfusionDuration: 0,
            totalOutputWeight: 0,
        });
    });

    it('should calculate stats correctly for a valid session', () => {
        const session = new BrewingSession();

        const infusion1 = new Infusion();
        infusion1.duration = 60;
        infusion1.waterWeight = 100;

        const infusion2 = new Infusion();
        infusion2.duration = 40;
        infusion2.waterWeight = 150;

        session.infusions = [infusion1, infusion2];

        const stats = calculateSessionStats(session);

        expect(stats.totalInfusions).toBe(2);
        expect(stats.totalBrewTime).toBe(100); // 60 + 40
        expect(stats.averageInfusionDuration).toBe(50); // 100 / 2
        expect(stats.totalOutputWeight).toBe(250); // 100 + 150
    });

    it('should handle undefined values gracefully', () => {
        const session = new BrewingSession();
        const infusion = new Infusion();
        // simulate missing data
        (infusion as any).duration = undefined;
        (infusion as any).waterWeight = undefined;

        session.infusions = [infusion];

        const stats = calculateSessionStats(session);

        expect(stats.totalBrewTime).toBe(0);
        expect(stats.totalOutputWeight).toBe(0);
    });
});
