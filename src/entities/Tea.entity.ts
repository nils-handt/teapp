import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BrewingSession } from './BrewingSession.entity';

@Entity('teas')
export class Tea {
    @PrimaryGeneratedColumn('uuid')
    teaId!: string;

    @Column('text')
    name!: string;

    @Column('text', { nullable: true })
    brand!: string | null;

    @Column('text', { nullable: true })
    type!: string | null;

    @Column('text', { nullable: true })
    subtype!: string | null;

    @Column('text', { nullable: true })
    region!: string | null;

    @Column('text', { nullable: true })
    subregion!: string | null;

    @Column('integer', { nullable: true })
    year!: number | null;

    @Column('text', { nullable: true })
    season!: string | null;

    @OneToMany(() => BrewingSession, (session) => session.tea)
    sessions!: BrewingSession[];
}
