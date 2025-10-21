import { bench, describe } from 'vitest';
import { selectOnStringComparsion, inserts, selectStatements, setup } from './fns';

describe('DB benchmarks', () => {
	describe('inserts', () => {
		describe('Insert with no indexes', async () => {
			const { syncDb, asyncDb } = await setup();

			const CREATE_TABLE_T1 = `CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));`;
			syncDb.exec(CREATE_TABLE_T1);
			await asyncDb({ sql: CREATE_TABLE_T1 });

			const INSERTS = inserts();
			bench('main thread - in memory', () => {
				syncDb.exec(INSERTS);
			});
			bench('worker - opfs', async () => {
				await asyncDb({ sql: INSERTS });
			});
		});
		describe('Insert with indexes', async () => {
			const { syncDb, asyncDb } = await setup();

			const CREATE_TABLE_T1 = `CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));`;
			syncDb.exec(CREATE_TABLE_T1);
			await asyncDb({ sql: CREATE_TABLE_T1 });

			const ADD_INDEXES = `
      CREATE INDEX IF NOT EXISTS i1 ON t1(a);
      CREATE INDEX IF NOT EXISTS i2 ON t1(b);
      CREATE INDEX IF NOT EXISTS i3 ON t1(c);
      `;

			syncDb.exec(ADD_INDEXES);
			await asyncDb({ sql: ADD_INDEXES });

			const INSERTS = inserts();
			bench('main thread - in memory', () => {
				syncDb.exec(INSERTS);
			});
			bench('worker - opfs', async () => {
				await asyncDb({ sql: INSERTS });
			});
		});
		describe('Insert with no indexes in transaction', async () => {
			const { syncDb, asyncDb } = await setup();

			const CREATE_TABLE_T1 = `CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));`;
			syncDb.exec(CREATE_TABLE_T1);
			await asyncDb({ sql: CREATE_TABLE_T1 });

			const INSERTS = inserts();
			bench('main thread - in memory', () => {
				syncDb.exec(`BEGIN; ${INSERTS} COMMIT;`);
			});
			bench('worker - opfs', async () => {
				await asyncDb({ sql: `BEGIN; ${INSERTS} COMMIT;` });
			});
		});
		describe('Insert with indexes in transaction', async () => {
			const { syncDb, asyncDb } = await setup();

			const CREATE_TABLE_T1 = `CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));`;
			syncDb.exec(CREATE_TABLE_T1);
			await asyncDb({ sql: CREATE_TABLE_T1 });

			const ADD_INDEXES = `
      CREATE INDEX IF NOT EXISTS i1 ON t1(a);
      CREATE INDEX IF NOT EXISTS i2 ON t1(b);
      CREATE INDEX IF NOT EXISTS i3 ON t1(c);
      `;

			syncDb.exec(ADD_INDEXES);
			await asyncDb({ sql: ADD_INDEXES });

			const INSERTS = inserts();
			bench('main thread - in memory', () => {
				syncDb.exec(`BEGIN; ${INSERTS} COMMIT;`);
			});
			bench('worker - opfs', async () => {
				await asyncDb({ sql: `BEGIN; ${INSERTS} COMMIT;` });
			});
		});
	});

	describe('selects', () => {
		describe('select without index', async () => {
			const { syncDb, asyncDb } = await setup();

			const CREATE_TABLE_T1 = `CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));`;
			syncDb.exec(CREATE_TABLE_T1);
			await asyncDb({ sql: CREATE_TABLE_T1 });

			const INSERTS = inserts(10000);
			syncDb.exec(`BEGIN; ${INSERTS} COMMIT;`);
			await asyncDb({ sql: `BEGIN; ${INSERTS} COMMIT;` });

			const selects = selectStatements();

			bench('main thread - in memory', () => {
				syncDb.exec(selects);
			});
			bench('worker - opfs', async () => {
				await asyncDb({ sql: selects });
			});
		});

		describe('select with index', async () => {
			const { syncDb, asyncDb } = await setup();

			const CREATE_TABLE_T1 = `CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));`;
			syncDb.exec(CREATE_TABLE_T1);
			await asyncDb({ sql: CREATE_TABLE_T1 });

			const ADD_INDEXES = `
      CREATE INDEX IF NOT EXISTS i1 ON t1(a);
      CREATE INDEX IF NOT EXISTS i2 ON t1(b);
      CREATE INDEX IF NOT EXISTS i3 ON t1(c);
      `;

			syncDb.exec(ADD_INDEXES);
			await asyncDb({ sql: ADD_INDEXES });
			const INSERTS = inserts(10000);
			syncDb.exec(`BEGIN; ${INSERTS} COMMIT;`);
			await asyncDb({ sql: `BEGIN; ${INSERTS} COMMIT;` });

			const selects = selectStatements();

			bench('main thread - in memory', () => {
				syncDb.exec(selects);
			});
			bench('worker - opfs', async () => {
				await asyncDb({ sql: selects });
			});
		});
	});
});
