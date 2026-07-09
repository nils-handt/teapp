import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class BaselineSchema1710000000000 implements MigrationInterface {
    name = 'BaselineSchema1710000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!await queryRunner.hasTable('brewing_vessels')) {
            await queryRunner.createTable(new Table({
                name: 'brewing_vessels',
                columns: [
                    { name: 'vesselId', type: 'varchar', isPrimary: true, isNullable: false },
                    { name: 'name', type: 'text', isNullable: false },
                    { name: 'vesselWeight', type: 'float', isNullable: false },
                    { name: 'lidWeight', type: 'float', isNullable: false },
                ],
            }));
        }

        if (!await queryRunner.hasTable('brewing_sessions')) {
            await queryRunner.createTable(new Table({
                name: 'brewing_sessions',
                columns: [
                    { name: 'sessionId', type: 'varchar', isPrimary: true, isNullable: false },
                    { name: 'teaName', type: 'text', isNullable: false },
                    { name: 'startTime', type: 'text', isNullable: false },
                    { name: 'endTime', type: 'text', isNullable: true },
                    { name: 'vesselWeight', type: 'float', isNullable: true },
                    { name: 'lidWeight', type: 'float', isNullable: true },
                    { name: 'dryTeaLeavesWeight', type: 'float', isNullable: true },
                    { name: 'currentWasteWater', type: 'float', isNullable: true },
                    { name: 'notes', type: 'text', isNullable: true },
                    { name: 'status', type: 'text', isNullable: false },
                    { name: 'waterTemperature', type: 'float', isNullable: true },
                    { name: 'brewingVesselId', type: 'text', isNullable: true },
                ],
                foreignKeys: [
                    {
                        columnNames: ['brewingVesselId'],
                        referencedTableName: 'brewing_vessels',
                        referencedColumnNames: ['vesselId'],
                    },
                ],
            }));
        }

        if (!await queryRunner.hasTable('infusions')) {
            await queryRunner.createTable(new Table({
                name: 'infusions',
                columns: [
                    { name: 'infusionId', type: 'varchar', isPrimary: true, isNullable: false },
                    { name: 'infusionNumber', type: 'integer', isNullable: false },
                    { name: 'waterWeight', type: 'float', isNullable: false },
                    { name: 'startTime', type: 'text', isNullable: false },
                    { name: 'duration', type: 'integer', isNullable: false },
                    { name: 'restDuration', type: 'integer', isNullable: true },
                    { name: 'wetTeaLeavesWeight', type: 'float', isNullable: true },
                    { name: 'note', type: 'text', isNullable: true },
                    { name: 'temperature', type: 'float', isNullable: true },
                    { name: 'sessionId', type: 'text', isNullable: false },
                ],
                foreignKeys: [
                    {
                        columnNames: ['sessionId'],
                        referencedTableName: 'brewing_sessions',
                        referencedColumnNames: ['sessionId'],
                        onDelete: 'CASCADE',
                    },
                ],
            }));
        }

        if (!await queryRunner.hasTable('scale_devices')) {
            await queryRunner.createTable(new Table({
                name: 'scale_devices',
                columns: [
                    { name: 'deviceId', type: 'text', isPrimary: true, isNullable: false },
                    { name: 'name', type: 'text', isNullable: false },
                    { name: 'address', type: 'text', isNullable: true },
                    { name: 'isPreferred', type: 'boolean', default: false, isNullable: false },
                    { name: 'lastConnected', type: 'text', isNullable: true },
                    { name: 'scaleType', type: 'text', isNullable: false },
                ],
            }));
        }

        if (!await queryRunner.hasTable('settings')) {
            await queryRunner.createTable(new Table({
                name: 'settings',
                columns: [
                    { name: 'key', type: 'text', isPrimary: true, isNullable: false },
                    { name: 'value', type: 'text', isNullable: false },
                ],
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('settings', true, true, true);
        await queryRunner.dropTable('scale_devices', true, true, true);
        await queryRunner.dropTable('infusions', true, true, true);
        await queryRunner.dropTable('brewing_sessions', true, true, true);
        await queryRunner.dropTable('brewing_vessels', true, true, true);
    }
}
