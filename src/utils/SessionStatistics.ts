import { BrewingSession } from '../entities/BrewingSession.entity';

interface SessionStats {
    totalInfusions: number;
    totalBrewTime: number; // in seconds
    averageInfusionDuration: number; // in seconds
    totalOutputWeight: number; // in grams
}

export const calculateSessionStats = (session: BrewingSession): SessionStats => {
    if (!session.infusions || session.infusions.length === 0) {
        return {
            totalInfusions: 0,
            totalBrewTime: 0,
            averageInfusionDuration: 0,
            totalOutputWeight: 0,
        };
    }

    const totalInfusions = session.infusions.length;

    const totalBrewTime = session.infusions.reduce((sum, infusion) => {
        return sum + (infusion.duration || 0);
    }, 0);

    const averageInfusionDuration = totalBrewTime / totalInfusions;

    const totalOutputWeight = session.infusions.reduce((sum, infusion) => {
        return sum + (infusion.waterWeight || 0);
    }, 0);

    return {
        totalInfusions,
        totalBrewTime,
        averageInfusionDuration,
        totalOutputWeight,
    };
};
