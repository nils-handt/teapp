import { AppDataSource } from '../database/dataSource';
import { Tea } from '../entities/Tea.entity';

export const teaRepository = AppDataSource.getRepository(Tea).extend({
    async saveTea(tea: Tea): Promise<Tea> {
        return this.save(tea);
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
