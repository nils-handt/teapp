#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_OPTIONS = {
    sessions: 20,
    teas: 5,
    vessels: 3,
};

export const TEA_TYPES = ['White', 'Green', 'Yellow', 'Oolong', 'Black', 'Dark'];

export const SUBTYPES_BY_TYPE = {
    White: ['Silver Needle', 'Bai Mudan', 'Shoumei'],
    Green: ['Longjing', 'Sencha', 'Bi Luo Chun'],
    Yellow: ['Junshan Yinzhen', 'Huoshan Huangya'],
    Oolong: ['Tieguanyin', 'Dancong', 'Wuyi Rock', 'High Mountain'],
    Black: ['Dianhong', 'Yunnan Red', 'Assam', 'Keemun'],
    Dark: ['Sheng Pu-erh', 'Shou Pu-erh', 'Liu Bao'],
};

export const BRANDS = [
    'Yunnan Sourcing',
    'White2Tea',
    'Bitterleaf Teas',
    'OneRiverTea',
    'Taiwan Tea Crafts',
    'TeaVivre',
    'Farmer Leaf',
];

export const REGIONS = {
    Fujian: ['Fuding', 'Wuyishan', 'Anxi'],
    Yunnan: ['Xishuangbanna', 'Lincang', 'Pu-erh'],
    Guangdong: ['Chaozhou', 'Fenghuang'],
    Zhejiang: ['Hangzhou', 'Shaoxing'],
    Taiwan: ['Nantou', 'Yuchi', 'Pinglin'],
    Assam: ['Dibrugarh', 'Jorhat'],
};

export const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

const NOTES = ['', '', '', 'floral finish', 'sweet finish', 'long finish'];
const VESSEL_NAMES = ['Gaiwan', 'Small teapot', 'Shibo', 'Porcelain pot', 'Travel teapot'];
const TABLE_SCHEMAS = {
    scale_devices: [
        ['deviceId', 'text PRIMARY KEY NOT NULL'],
        ['name', 'text NOT NULL'],
        ['address', 'text'],
        ['isPreferred', 'boolean NOT NULL DEFAULT (0)'],
        ['lastConnected', 'text'],
        ['scaleType', 'text NOT NULL'],
    ],
    settings: [
        ['key', 'text PRIMARY KEY NOT NULL'],
        ['value', 'text NOT NULL'],
    ],
    brewing_vessels: [
        ['vesselId', 'varchar PRIMARY KEY NOT NULL'],
        ['name', 'text NOT NULL'],
        ['vesselWeight', 'float NOT NULL'],
        ['lidWeight', 'float NOT NULL'],
    ],
    infusions: [
        ['infusionId', 'varchar PRIMARY KEY NOT NULL'],
        ['infusionNumber', 'integer NOT NULL'],
        ['waterWeight', 'float NOT NULL'],
        ['startTime', 'text NOT NULL'],
        ['duration', 'integer NOT NULL'],
        ['restDuration', 'integer'],
        ['wetTeaLeavesWeight', 'float'],
        ['sessionId', 'varchar NOT NULL'],
        ['note', 'text'],
        ['temperature', 'float'],
    ],
    migrations: [
        ['id', 'integer PRIMARY KEY AUTOINCREMENT NOT NULL'],
        ['timestamp', 'bigint NOT NULL'],
        ['name', 'varchar NOT NULL'],
    ],
    teas: [
        ['teaId', 'varchar PRIMARY KEY NOT NULL'],
        ['name', 'text NOT NULL'],
        ['brand', 'text'],
        ['type', 'text'],
        ['subtype', 'text'],
        ['region', 'text'],
        ['subregion', 'text'],
        ['year', 'integer'],
        ['season', 'text'],
    ],
    brewing_sessions: [
        ['sessionId', 'varchar PRIMARY KEY NOT NULL'],
        ['teaName', 'text NOT NULL'],
        ['startTime', 'text NOT NULL'],
        ['endTime', 'text'],
        ['vesselWeight', 'float'],
        ['lidWeight', 'float'],
        // Kept for compatibility with existing exports from versions that had tea trays.
        ['trayWeight', 'float'],
        ['dryTeaLeavesWeight', 'float'],
        ['currentWasteWater', 'float'],
        ['notes', 'text'],
        ['status', 'text NOT NULL'],
        ['waterTemperature', 'float'],
        ['brewingVesselId', 'varchar'],
        ['teaId', 'text'],
    ],
};

const sessionTemperature = {
    White: 85,
    Green: 80,
    Yellow: 82,
    Oolong: 95,
    Black: 95,
    Dark: 98,
};

const round = (value, digits = 1) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

const createSeededRandom = (seed) => {
    let state = 2166136261;
    for (const character of String(seed)) {
        state ^= character.charCodeAt(0);
        state = Math.imul(state, 16777619);
    }

    return () => {
        state = (state + 0x6D2B79F5) | 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

const createRandom = (seed) => seed === undefined ? Math.random : createSeededRandom(seed);

const createDeterministicId = (sequence) => {
    const suffix = sequence.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${suffix}`;
};

const createIdFactory = (seed) => {
    let sequence = 0;
    const usedIds = new Set();

    return () => {
        let id;
        do {
            id = seed === undefined ? randomUUID() : createDeterministicId(sequence++);
        } while (usedIds.has(id));

        usedIds.add(id);
        return id;
    };
};

const randomInt = (random, min, max) => Math.floor(random() * (max - min + 1)) + min;
const randomBetween = (random, min, max) => min + random() * (max - min);
const randomChoice = (random, values) => values[randomInt(random, 0, values.length - 1)];

const formatTeaLabel = (tea) => [tea.year, tea.name, tea.brand, tea.type]
    .filter((part) => part !== null && part !== undefined && String(part).trim())
    .join(' ');

const shuffle = (random, values) => {
    for (let index = values.length - 1; index > 0; index -= 1) {
        const swapIndex = randomInt(random, 0, index);
        [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    return values;
};

const schemaFor = (tableName) => TABLE_SCHEMAS[tableName].map(([column, value]) => ({
    column: `"${column}"`,
    value,
}));

const foreignKey = (constraint, value) => ({ constraint, value });

const createTables = ({ scaleDevices, settings, vessels, infusions, migrations, teas, sessions }) => [
    {
        name: 'scale_devices',
        schema: schemaFor('scale_devices'),
        values: scaleDevices,
    },
    {
        name: 'settings',
        schema: schemaFor('settings'),
        values: settings,
    },
    {
        name: 'brewing_vessels',
        schema: schemaFor('brewing_vessels'),
        values: vessels,
    },
    {
        name: 'infusions',
        schema: [
            ...schemaFor('infusions'),
            foreignKey(
                '"FK_6d3fc7157dbfea09b176065a3ec"',
                'FOREIGN KEY ("sessionId") REFERENCES "brewing_sessions" ("sessionId") ON DELETE CASCADE ON UPDATE NO ACTION',
            ),
        ],
        values: infusions,
    },
    {
        name: 'migrations',
        schema: schemaFor('migrations'),
        values: migrations,
    },
    {
        name: 'teas',
        schema: schemaFor('teas'),
        values: teas,
    },
    {
        name: 'brewing_sessions',
        schema: [
            ...schemaFor('brewing_sessions'),
            foreignKey(
                '"FK_4b4d16e986ccbfa581c6db8566c"',
                'FOREIGN KEY ("brewingVesselId") REFERENCES "brewing_vessels" ("vesselId") ON DELETE NO ACTION ON UPDATE NO ACTION',
            ),
        ],
        values: sessions,
    },
];

const validateOptions = ({ sessions, teas, vessels }) => {
    for (const [name, value] of Object.entries({ sessions, teas, vessels })) {
        if (!Number.isInteger(value) || value < 0) {
            throw new Error(`--${name} must be a non-negative integer`);
        }
    }

    if (sessions > 0 && teas === 0) {
        throw new Error('--teas must be at least 1 when --sessions is greater than 0');
    }
};

/**
 * Creates a restore-compatible full SQLite backup for local development.
 *
 * `now` is injectable so callers can make generated dates repeatable in tests.
 */
export const generateSampleDataset = ({
    sessions = DEFAULT_OPTIONS.sessions,
    teas = DEFAULT_OPTIONS.teas,
    vessels = DEFAULT_OPTIONS.vessels,
    seed,
    now = new Date(),
} = {}) => {
    validateOptions({ sessions, teas, vessels });

    const random = createRandom(seed);
    const createId = createIdFactory(seed);
    const teaRows = [];
    const teaRecords = [];

    for (let index = 0; index < teas; index += 1) {
        const type = randomChoice(random, TEA_TYPES);
        const subtype = randomChoice(random, SUBTYPES_BY_TYPE[type]);
        const region = randomChoice(random, Object.keys(REGIONS));
        const tea = {
            teaId: createId(),
            name: `${subtype} ${region} ${String(index + 1).padStart(2, '0')}`,
            brand: randomChoice(random, BRANDS),
            type,
            subtype,
            region,
            subregion: randomChoice(random, REGIONS[region]),
            year: randomChoice(random, YEARS),
            season: randomChoice(random, SEASONS),
        };

        teaRecords.push(tea);
        teaRows.push([
            tea.teaId,
            tea.name,
            tea.brand,
            tea.type,
            tea.subtype,
            tea.region,
            tea.subregion,
            tea.year,
            tea.season,
        ]);
    }

    const vesselRows = [];
    const vesselRecords = [];
    for (let index = 0; index < vessels; index += 1) {
        const vessel = {
            vesselId: createId(),
            name: `${randomChoice(random, VESSEL_NAMES)} ${index + 1}`,
            vesselWeight: round(randomBetween(random, 80, 220)),
            lidWeight: round(randomBetween(random, 20, 60)),
        };

        vesselRecords.push(vessel);
        vesselRows.push([vessel.vesselId, vessel.name, vessel.vesselWeight, vessel.lidWeight]);
    }

    const teaIndexes = shuffle(random, Array.from({ length: sessions }, (_, index) => (
        index < teaRecords.length ? index : randomInt(random, 0, teaRecords.length - 1)
    )));
    const infusionRows = [];
    const sessionRows = [];
    const nowMs = new Date(now).getTime();

    for (let index = 0; index < sessions; index += 1) {
        const tea = teaRecords[teaIndexes[index]];
        const vessel = vesselRecords.length > 0 ? randomChoice(random, vesselRecords) : null;
        const sessionId = createId();
        const dryTeaLeavesWeight = round(randomBetween(random, 4, 10));
        const waterTemperature = sessionTemperature[tea.type];
        const infusionCount = randomInt(random, 3, 7);
        const startMs = nowMs - randomInt(random, 1, 540) * 24 * 60 * 60 * 1000;
        let infusionStartMs = startMs + 30 * 1000;
        let lastInfusionEndMs = infusionStartMs;

        for (let infusionIndex = 0; infusionIndex < infusionCount; infusionIndex += 1) {
            const duration = randomInt(random, 35, 180);
            const restDuration = randomInt(random, 15, 240);
            const waterWeight = round(randomBetween(random, 55, 160));
            const wetTeaLeavesWeight = round(dryTeaLeavesWeight + randomBetween(random, 0, 7) + infusionIndex * 1.5);

            infusionRows.push([
                createId(),
                infusionIndex + 1,
                waterWeight,
                new Date(infusionStartMs).toISOString(),
                duration,
                restDuration,
                wetTeaLeavesWeight,
                sessionId,
                randomChoice(random, NOTES),
                waterTemperature,
            ]);

            lastInfusionEndMs = infusionStartMs + duration * 1000;
            infusionStartMs = lastInfusionEndMs + restDuration * 1000;
        }

        const endMs = lastInfusionEndMs + 30 * 1000;
        sessionRows.push([
            sessionId,
            formatTeaLabel(tea),
            new Date(startMs).toISOString(),
            new Date(endMs).toISOString(),
            vessel?.vesselWeight ?? null,
            vessel?.lidWeight ?? null,
            null,
            dryTeaLeavesWeight,
            round(randomBetween(random, 0, 12)),
            randomChoice(random, ['', '', 'Sample session', 'pleasant aftertaste']),
            'completed',
            waterTemperature,
            vessel?.vesselId ?? null,
            tea.teaId,
        ]);
    }

    return {
        database: 'teapp',
        version: 1,
        encrypted: false,
        mode: 'full',
        tables: createTables({
            scaleDevices: [],
            settings: [
                ['devMode', 'true'],
                ['logLevel', 'debug'],
                ['logToFileEnabled', 'false'],
                ['weightLoggerEnabled', 'false'],
                ['playbackSpeed', '1'],
                ['hasSeenTutorial', 'true'],
                ['statisticsPeriod', 'total'],
            ],
            vessels: vesselRows,
            infusions: infusionRows,
            migrations: [
                [1, 1710000000000, 'BaselineSchema1710000000000'],
                [2, 1720000000000, 'AddTeaEntity1720000000000'],
            ],
            teas: teaRows,
            sessions: sessionRows,
        }),
    };
};

const parseCount = (name, value) => {
    if (value === undefined || value === '') {
        throw new Error(`Missing value for --${name}`);
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`--${name} must be a non-negative integer`);
    }
    return parsed;
};

export const parseArgs = (argv) => {
    const options = { ...DEFAULT_OPTIONS };
    let output;
    let seed;

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        const [inlineName, inlineValue] = argument.split('=', 2);
        const name = inlineName;
        const value = inlineValue ?? argv[index + 1];

        if (name === '--help' || name === '-h') {
            return { help: true };
        }
        if (name === '--sessions') {
            options.sessions = parseCount('sessions', value);
        } else if (name === '--teas') {
            options.teas = parseCount('teas', value);
        } else if (name === '--vessels') {
            options.vessels = parseCount('vessels', value);
        } else if (name === '--seed') {
            if (value === undefined || value === '') {
                throw new Error('Missing value for --seed');
            }
            seed = value;
        } else if (name === '--output') {
            if (value === undefined || value === '') {
                throw new Error('Missing value for --output');
            }
            output = value;
        } else {
            throw new Error(`Unknown option: ${argument}`);
        }

        if (inlineValue === undefined && (name === '--sessions' || name === '--teas' || name === '--vessels' || name === '--seed' || name === '--output')) {
            index += 1;
        }
    }

    return { ...options, output, seed };
};

const helpText = `Generate a restore-compatible Teapp sample backup.

Usage:
  npm run generate:sample-data -- [options]

Options:
  --sessions <number>  Number of completed brewing sessions (default: 20)
  --teas <number>      Number of tea entities (default: 5)
  --vessels <number>   Number of brewing vessels (default: 3)
  --seed <value>       Repeatable pseudo-random values and IDs
  --output <file>      Output path (default: teapp_sample_<timestamp>.json)
  --help               Show this help
`;

const defaultOutputPath = () => `teapp_sample_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

const writeDataset = async (outputPath, dataset) => {
    const absolutePath = resolve(outputPath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
    return absolutePath;
};

const main = async () => {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        console.log(helpText);
        return;
    }

    const dataset = generateSampleDataset(options);
    const outputPath = await writeDataset(options.output ?? defaultOutputPath(), dataset);
    const tableRows = Object.fromEntries(dataset.tables.map((table) => [table.name, table.values.length]));
    console.log(`Wrote ${outputPath}`);
    console.log(`Generated ${tableRows.teas} teas, ${tableRows.brewing_sessions} sessions, ${tableRows.brewing_vessels} vessels, and ${tableRows.infusions} infusions.`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
