import { AppDataSource } from '../database/dataSource';
import { BrewingSession } from '../entities/BrewingSession.entity';

export const sessionRepository = AppDataSource.getRepository(BrewingSession).extend({
    async saveSession(session: BrewingSession): Promise<BrewingSession> {
        return this.save(session);
    },
});
