import { Between } from 'typeorm';
import { AppDataSource } from '../database/dataSource';
import { BrewingVessel } from '../entities/BrewingVessel.entity';

const VESSEL_WEIGHT_TOLERANCE = 2;
const LID_WEIGHT_TOLERANCE = 1;

export const brewingVesselRepository = AppDataSource.getRepository(BrewingVessel).extend({
    async saveBrewingVessel(vessel: BrewingVessel): Promise<BrewingVessel> {
        return this.save(vessel);
    },

    async findSimilarVessel(vesselWeight: number, lidWeight: number): Promise<BrewingVessel | null> {
        const matches = await this.find({
            where: {
                vesselWeight: Between(vesselWeight - VESSEL_WEIGHT_TOLERANCE, vesselWeight + VESSEL_WEIGHT_TOLERANCE),
                lidWeight: Between(lidWeight - LID_WEIGHT_TOLERANCE, lidWeight + LID_WEIGHT_TOLERANCE),
            },
        });

        if (matches.length === 0) {
            return null;
        }

        return matches
            .slice()
            .sort((left, right) => {
                const leftDistance = Math.abs(left.vesselWeight - vesselWeight) + Math.abs(left.lidWeight - lidWeight);
                const rightDistance = Math.abs(right.vesselWeight - vesselWeight) + Math.abs(right.lidWeight - lidWeight);
                return leftDistance - rightDistance;
            })[0];
    },
});
