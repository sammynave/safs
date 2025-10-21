import { browser } from '$app/environment';

export async function getWorker() {
	if (browser) {
		const { sqlite3Worker1Promiser } = await import('@sqlite.org/sqlite-wasm');

		// const log = console.log;
		const error = console.error;

		const initializeSQLite = async () => {
			try {
				// log('Loading and initializing SQLite3 module...');

				const asyncDb = await new Promise((resolve) => {
					const _promiser = sqlite3Worker1Promiser({
						onready: () => {
							resolve(_promiser);
						}
					});
				});

				const configResponse = await asyncDb('config-get', {});
				// log('Running SQLite3 version', configResponse.result.version.libVersion);

				const openResponse = await asyncDb('open', {
					filename: 'file:safs.sqlite3?vfs=opfs',
					// flags: 'ct'
					flags: 'c'
				});
				const { dbId } = openResponse;
				// log(
				// 	'OPFS is available, created persisted database at',
				// 	openResponse.result.filename.replace(/^file:(.*?)\?vfs=opfs$/, '$1')
				// );

				// await asyncDb('close', { dbId });
				return async ({ sql, bind, callback, close }) => {
					const options = {
						dbId,
						sql,
						// resultRows: [], // Request resultRows
						rowMode: 'object',
						close
					};
					if (close) {
						return await asyncDb('close', { dbId });
					}
					if (bind) {
						options.bind = bind;
					}

					if (callback) {
						options.callback = callback;
					}
					return await asyncDb('exec', options);
				};
			} catch (err) {
				if (!(err instanceof Error)) {
					err = new Error(err.result.message);
				}
				error(err.name, err.message);
			}
		};

		return initializeSQLite();
	}
}
