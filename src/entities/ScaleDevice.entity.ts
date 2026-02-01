import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('scale_devices')
export class ScaleDevice {
    @PrimaryColumn('text')
    deviceId!: string;

    @Column('text')
    name!: string;

    @Column('text', { nullable: true })
    address!: string;

    @Column('boolean', { default: false })
    isPreferred!: boolean;

    @Column('text', { nullable: true })
    lastConnected!: string; // ISO date string
}
