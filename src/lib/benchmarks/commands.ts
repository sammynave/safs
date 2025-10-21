import { convertNumberToWords } from './number-to-words';

export const CREATE_TABLE_T1 = `CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));`;
export const CREATE_TABLE_T2 = `CREATE TABLE t2(a INTEGER, b INTEGER, c VARCHAR(100));`;
export const DROP_TABLE_T1 = `DROP TABLE IF EXISTS t1;`;
export const DROP_TABLE_T2 = `DROP TABLE IF EXISTS t2;`;

export const ADD_INDEX = `CREATE INDEX IF NOT EXISTS i1 ON t1(c);`;

// TODO: revisit these tuning parameters for max performance
export const PRAGMA = `
			PRAGMA journal_mode='OFF';
      PRAGMA page_size=32768;
      PRAGMA cache_size=10000;
      PRAGMA synchronous='OFF';
      PRAGMA temp_store='MEMORY';
      -- PRAGMA foreign_keys='ON'; -- we want foreign key constraints to be enforced
    `;
export function insertIndividualStatements(size, useIndex = false) {
	let INSERTS = '';
	for (const i in Array.from({ length: size })) {
		const num = Math.floor(Math.random() * 100000);
		const name = convertNumberToWords(num);
		INSERTS += `INSERT INTO t1 VALUES(${i + 1},${num},'${name}');`;
	}
	return useIndex ? `${ADD_INDEX} ${INSERTS}` : `${INSERTS}`;
}

export function selectWithoutIndex(size = 100) {
	let SELECTS = 'BEGIN;';
	for (const i in Array.from({ length: size })) {
		SELECTS += `SELECT count(*), avg(b) FROM t1 WHERE b>=${Number(i) * 100} AND b<${Number(i) * 100 + 1000};`;
	}
	return `${SELECTS} COMMIT;`;
}

export function selectOnStringComparsion(size = 100) {
	let SELECTS = 'BEGIN;';
	for (const i in Array.from({ length: size })) {
		SELECTS += `SELECT count(*), avg(b) FROM t1 WHERE c LIKE '%${convertNumberToWords(Number(i))}%';`;
	}
	return `${SELECTS} COMMIT;`;
}
