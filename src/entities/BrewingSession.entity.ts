import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Infusion } from './Infusion.entity.ts';
import { BrewingVessel } from './BrewingVessel.entity';
import { Tea } from './Tea.entity';

@Entity('brewing_sessions')
export class BrewingSession {
    @PrimaryGeneratedColumn('uuid')
    sessionId!: string;

    @Column('text', { nullable: true })
    teaName!: string;

    @Column('text', { nullable: true })
    teaId!: string | null;

    @Column('text')
    startTime!: string; // ISO date string

    @Column('text', { nullable: true })
    endTime!: string; // ISO date string

    @Column('float', { nullable: true })
    vesselWeight!: number;

    @Column('float', { nullable: true })
    lidWeight!: number;

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

    @ManyToOne(() => Tea, (tea) => tea.sessions, { nullable: true })
    @JoinColumn({ name: 'teaId', referencedColumnName: 'teaId' })
    tea!: Tea | null;

    @OneToMany(() => Infusion, (infusion) => infusion.session, { cascade: true })
    infusions!: Infusion[];
}
