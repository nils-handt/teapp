import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

const HISTORY_START_TIME_INDEX = 'IDX_brewing_sessions_start_time';

export class AddHistoryStartTimeIndex1730000000000 implements MigrationInterface {
    name = 'AddHistoryStartTimeIndex1730000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const sessionTable = await queryRunner.getTable('brewing_sessions');
        if (!sessionTable || sessionTable.indices.some((index) => index.name === HISTORY_START_TIME_INDEX)) {
            return;
        }

        await queryRunner.createIndex('brewing_sessions', new TableIndex({
            name: HISTORY_START_TIME_INDEX,
            columnNames: ['startTime'],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const sessionTable = await queryRunner.getTable('brewing_sessions');
        const index = sessionTable?.indices.find((candidate) => candidate.name === HISTORY_START_TIME_INDEX);
        if (index) {
            await queryRunner.dropIndex('brewing_sessions', index);
        }
    }
}
