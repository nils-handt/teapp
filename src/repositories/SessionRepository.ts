import { AppDataSource } from '../database/dataSource';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Like } from 'typeorm';

const SESSION_RELATIONS = ['infusions', 'brewingVessel', 'tea'];

export const sessionRepository = AppDataSource.getRepository(BrewingSession).extend({
    async saveSession(session: BrewingSession): Promise<BrewingSession> {
        return this.save(session);
    },

    async getActiveSession(): Promise<BrewingSession | null> {
        return this.findOne({
            where: { status: 'active' },
            order: {
                startTime: 'DESC',
            },
            relations: SESSION_RELATIONS,
        });
    },

    async getAllSessions(): Promise<BrewingSession[]> {
        return this.find({
            order: {
                startTime: 'DESC',
            },
            relations: SESSION_RELATIONS,
        });
    },

    async getSessionById(sessionId: string): Promise<BrewingSession | null> {
        return this.findOne({
            where: { sessionId },
            relations: SESSION_RELATIONS,
        });
    },

    async getSessionsByTeaName(teaName: string): Promise<BrewingSession[]> {
        return this.find({
            where: { teaName: Like(`%${teaName}%`) },
            order: {
                startTime: 'DESC',
            },
            relations: SESSION_RELATIONS,
        });
    },

    async getKnownTeaNames(): Promise<string[]> {
        const sessions = await this.find({
            order: {
                startTime: 'DESC',
            },
        });

        const knownTeaNames: string[] = [];
        const seenTeaNames = new Set<string>();

        sessions.forEach((session) => {
            const trimmedTeaName = session.teaName?.trim();
            if (!trimmedTeaName) {
                return;
            }

            const normalizedTeaName = trimmedTeaName.toLowerCase();
            if (seenTeaNames.has(normalizedTeaName)) {
                return;
            }

            seenTeaNames.add(normalizedTeaName);
            knownTeaNames.push(trimmedTeaName);
        });

        return knownTeaNames;
    },

    async deleteSession(sessionId: string): Promise<void> {
        await this.delete(sessionId);
    },
});
