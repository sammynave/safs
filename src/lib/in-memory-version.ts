import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { browser } from '$app/environment';

export async function getInMemory() {
	if (browser) {
		const log = console.log;
		const error = console.error;

		const start = (sqlite3) => {
			// log('Running SQLite3 version', sqlite3.version.libVersion);
			// an example https://github.com/evoluhq/evolu/blob/86d1bb444f5cc0ef929cd04184fd396dba32c329/packages/web/src/WasmSqliteDriver.ts#L8
			const db = new sqlite3.oo1.DB(':memory:', 'c' /*, 'ct' */);
			return db;
		};

		const initializeSQLite = async () => {
			try {
				// log('Loading and initializing SQLite3 module...');
				const sqlite3 = await sqlite3InitModule({
					// print: log,
					// printErr: error
				});
				// log('Done IN MEMORY VERSION initializing. Running demo...');
				return start(sqlite3);
			} catch (err) {
				error('Initialization error:', err.name, err.message);
			}
		};

		return initializeSQLite();
	}
}
