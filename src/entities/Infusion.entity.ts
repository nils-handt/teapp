import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BrewingSession } from './BrewingSession.entity.ts';

@Entity('infusions')
export class Infusion {
    @PrimaryGeneratedColumn('uuid')
    infusionId!: string;

    @Column('integer')
    infusionNumber!: number;

    @Column('float')
    waterWeight!: number;

    @Column('text')
    startTime!: string; // ISO date string

    @Column('integer')
    duration!: number; // in seconds

    @Column('integer', { nullable: true })
    restDuration!: number; // in seconds

    @Column('float', { nullable: true })
    wetTeaLeavesWeight!: number;

    @ManyToOne(() => BrewingSession, (session) => session.infusions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sessionId' })
    session!: BrewingSession;

    @Column('text')
    sessionId!: string;
}
