import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BrewingSession } from './BrewingSession.entity';

@Entity('brewing_vessels')
export class BrewingVessel {
    @PrimaryGeneratedColumn('uuid')
    vesselId!: string;

    @Column('text')
    name!: string;

    @Column('float')
    vesselWeight!: number;

    @Column('float')
    lidWeight!: number;

    @OneToMany(() => BrewingSession, (session) => session.brewingVessel)
    sessions!: BrewingSession[];
}
