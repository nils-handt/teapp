import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Infusion } from './Infusion.entity.ts';

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
    dryTeaLeavesWeight!: number;

    @Column('text', { nullable: true })
    notes!: string;

    @Column('text')
    status!: string; // 'active', 'completed'

    @Column('float', { nullable: true })
    waterTemperature!: number;

    @OneToMany(() => Infusion, (infusion) => infusion.session, { cascade: true })
    infusions!: Infusion[];
}
