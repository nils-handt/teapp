import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Infusion } from './Infusion.entity.ts';
import { BrewingVessel } from './BrewingVessel.entity';

@Entity('brewing_sessions')
export class BrewingSession {
    @PrimaryGeneratedColumn('uuid')
    sessionId!: string;

    @Column('text')
    teaName!: string;

    @Column('text')
    startTime!: string; // ISO date string

    @Column('text', { nullable: true })
    endTime!: string; // ISO date string

    @Column('float', { nullable: true })
    vesselWeight!: number;

    @Column('float', { nullable: true })
    lidWeight!: number;

    @Column('float', { nullable: true })
    trayWeight!: number;

    @Column('float', { nullable: true })
    dryTeaLeavesWeight!: number;

    @Column('float', { nullable: true })
    currentWasteWater!: number;

    @Column('text', { nullable: true })
    notes!: string;

    @Column('text')
    status!: string; // 'active', 'completed'

    @Column('float', { nullable: true })
    waterTemperature!: number;

    @Column('text', { nullable: true })
    brewingVesselId!: string | null;

    @ManyToOne(() => BrewingVessel, (brewingVessel) => brewingVessel.sessions, { nullable: true })
    @JoinColumn({ name: 'brewingVesselId', referencedColumnName: 'vesselId' })
    brewingVessel!: BrewingVessel | null;

    @OneToMany(() => Infusion, (infusion) => infusion.session, { cascade: true })
    infusions!: Infusion[];
}
