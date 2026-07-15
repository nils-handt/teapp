import { AppDataSource } from '../database/dataSource';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Tea } from '../entities/Tea.entity';
import { formatTeaLabel } from '../utils/teaSearch';

export const teaRepository = AppDataSource.getRepository(Tea).extend({
    async saveTea(tea: Tea): Promise<Tea> {
        return this.save(tea);
    },

    async updateSharedTea(tea: Tea): Promise<Tea> {
        return AppDataSource.transaction(async (manager) => {
            const savedTea = await manager.getRepository(Tea).save(tea);
            await manager.getRepository(BrewingSession).update(
                { teaId: savedTea.teaId },
                { teaName: formatTeaLabel(savedTea) },
            );
            return savedTea;
        });
    },

    async getAllTeas(): Promise<Tea[]> {
        return this.find({
            order: {
                name: 'ASC',
            },
        });
    },

    async getTeaById(teaId: string): Promise<Tea | null> {
        return this.findOne({
            where: { teaId },
        });
    },
});
