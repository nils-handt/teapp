import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

type LegacyTeaNameRow = {
    name: string;
    normalizedName: string;
};

type ExistingTeaRow = {
    teaId: string;
};

const createId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    return `tea-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export class AddTeaEntity1720000000000 implements MigrationInterface {
    name = 'AddTeaEntity1720000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!await queryRunner.hasTable('teas')) {
            await queryRunner.createTable(new Table({
                name: 'teas',
                columns: [
                    { name: 'teaId', type: 'varchar', isPrimary: true, isNullable: false },
                    { name: 'name', type: 'text', isNullable: false },
                    { name: 'brand', type: 'text', isNullable: true },
                    { name: 'type', type: 'text', isNullable: true },
                    { name: 'subtype', type: 'text', isNullable: true },
                    { name: 'region', type: 'text', isNullable: true },
                    { name: 'subregion', type: 'text', isNullable: true },
                    { name: 'year', type: 'integer', isNullable: true },
                    { name: 'season', type: 'text', isNullable: true },
                ],
            }));
        }

        const sessionTable = await queryRunner.getTable('brewing_sessions');
        if (sessionTable && !sessionTable.findColumnByName('teaId')) {
            await queryRunner.addColumn('brewing_sessions', new TableColumn({
                name: 'teaId',
                type: 'text',
                isNullable: true,
            }));
        }

        if (!sessionTable?.findColumnByName('teaName')) {
            return;
        }

        const legacyRows = await queryRunner.query(`
            SELECT MIN(TRIM(teaName)) AS name, LOWER(TRIM(teaName)) AS normalizedName
            FROM brewing_sessions
            WHERE teaName IS NOT NULL AND TRIM(teaName) <> ''
            GROUP BY LOWER(TRIM(teaName))
        `) as LegacyTeaNameRow[];

        for (const row of legacyRows) {
            const existingRows = await queryRunner.query(
                'SELECT teaId FROM teas WHERE LOWER(name) = ? LIMIT 1',
                [row.normalizedName],
            ) as ExistingTeaRow[];
            const teaId = existingRows[0]?.teaId ?? createId();

            if (!existingRows[0]) {
                await queryRunner.query(
                    `INSERT INTO teas
                        (teaId, name, brand, type, subtype, region, subregion, year, season)
                     VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
                    [teaId, row.name],
                );
            }

            await queryRunner.query(
                'UPDATE brewing_sessions SET teaId = ? WHERE teaId IS NULL AND LOWER(TRIM(teaName)) = ?',
                [teaId, row.normalizedName],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const sessionTable = await queryRunner.getTable('brewing_sessions');
        if (sessionTable?.findColumnByName('teaId')) {
            await queryRunner.dropColumn('brewing_sessions', 'teaId');
        }

        await queryRunner.dropTable('teas', true, true, true);
    }
}
