import { AppDataSource } from '../database/dataSource';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Like } from 'typeorm';

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
            relations: ['infusions'],
        });
    },

    async getAllSessions(): Promise<BrewingSession[]> {
        return this.find({
            order: {
                startTime: 'DESC',
            },
            relations: ['infusions'],
        });
    },

    async getSessionById(sessionId: string): Promise<BrewingSession | null> {
        return this.findOne({
            where: { sessionId },
            relations: ['infusions'],
        });
    },

    async getSessionsByTeaName(teaName: string): Promise<BrewingSession[]> {
        return this.find({
            where: { teaName: Like(`%${teaName}%`) },
            order: {
                startTime: 'DESC',
            },
            relations: ['infusions'],
        });
    },

    async deleteSession(sessionId: string): Promise<void> {
        await this.delete(sessionId);
    },
});
