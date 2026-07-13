import { AppDataSource } from '../database/dataSource';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { In, Like } from 'typeorm';

const DETAIL_SESSION_RELATIONS = ['infusions', 'brewingVessel', 'tea'];
const HISTORY_SESSION_RELATIONS = ['infusions', 'tea'];

export const HISTORY_PAGE_SIZE = 50;

export type HistoryPageOptions = {
    offset?: number;
    teaIds?: string[];
};

export type HistoryPage = {
    sessions: BrewingSession[];
    hasMore: boolean;
};

const historyWhere = (teaIds: string[] | undefined) => (
    teaIds ? { teaId: In(teaIds) } : undefined
);

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
            relations: DETAIL_SESSION_RELATIONS,
        });
    },

    async getAllSessions(): Promise<BrewingSession[]> {
        return this.find({
            order: {
                startTime: 'DESC',
            },
            relations: DETAIL_SESSION_RELATIONS,
        });
    },

    async getHistoryPage({ offset = 0, teaIds }: HistoryPageOptions = {}): Promise<HistoryPage> {
        if (teaIds?.length === 0) {
            return { sessions: [], hasMore: false };
        }

        const sessions = await this.find({
            ...(teaIds ? { where: historyWhere(teaIds) } : {}),
            order: {
                startTime: 'DESC',
            },
            relations: HISTORY_SESSION_RELATIONS,
            skip: offset,
            take: HISTORY_PAGE_SIZE + 1,
        });

        return {
            sessions: sessions.slice(0, HISTORY_PAGE_SIZE),
            hasMore: sessions.length > HISTORY_PAGE_SIZE,
        };
    },

    async getAllHistorySessions({ teaIds }: Pick<HistoryPageOptions, 'teaIds'> = {}): Promise<BrewingSession[]> {
        if (teaIds?.length === 0) {
            return [];
        }

        return this.find({
            ...(teaIds ? { where: historyWhere(teaIds) } : {}),
            order: {
                startTime: 'DESC',
            },
            relations: HISTORY_SESSION_RELATIONS,
        });
    },

    async getSessionById(sessionId: string): Promise<BrewingSession | null> {
        return this.findOne({
            where: { sessionId },
            relations: DETAIL_SESSION_RELATIONS,
        });
    },

    async getSessionsByTeaName(teaName: string): Promise<BrewingSession[]> {
        return this.find({
            where: { teaName: Like(`%${teaName}%`) },
            order: {
                startTime: 'DESC',
            },
            relations: DETAIL_SESSION_RELATIONS,
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
