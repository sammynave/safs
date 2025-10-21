import { getInMemory } from '$lib/in-memory-version';
import { getWorker } from '$lib/worker-version';
import { convertNumberToWords } from './number-to-words';

const INSERT_COUNT = 100;
export const inserts = (size = INSERT_COUNT) => {
	let INSERTS = '';
	for (const i in Array.from({ length: size })) {
		const num = Math.floor(Math.random() * 100000);
		const name = convertNumberToWords(num);
		INSERTS += `INSERT INTO t1 VALUES(${i + 1},${num},'${name}');`;
	}
	return INSERTS;
};
export const setup = async () => {
	await (await navigator.storage.getDirectory()).remove({ recursive: true });
	const syncDb = await getInMemory();
	const PRAGMA = `
			PRAGMA journal_mode='OFF';
	    PRAGMA synchronous='OFF';
	    PRAGMA temp_store='MEMORY';
      PRAGMA locking_mode = 'EXCLUSIVE';
	  `;
	syncDb.exec(PRAGMA);

	const asyncDb = await getWorker();
	return {
		syncDb,
		asyncDb
	};
};
const SELECT_SIZE = 100;
export const selectStatements = (size = SELECT_SIZE) => {
	let SELECTS = '';
	for (const i in Array.from({ length: size })) {
		SELECTS += `SELECT count(*), avg(b) FROM t1 WHERE b>=${Number(i) * 100} AND b<${Number(i) * 100 + 1000};`;
	}
	return SELECTS;
};

export const selectOnStringComparsion = (size = SELECT_SIZE) => {
	let SELECTS = '';
	for (const i in Array.from({ length: size })) {
		SELECTS += `SELECT count(*), avg(b) FROM t1 WHERE c LIKE '%${convertNumberToWords(Number(i))}%';`;
	}
	return SELECTS;
};
