<script>
	import { inserts, selectStatements, setup } from '$lib/benchmarks/fns';
	import { getInMemory } from '$lib/in-memory-version';
	import { getWorker } from '$lib/worker-version';

	function trunc(str, digits) {
		const re = new RegExp('(\\d+\\.\\d{' + digits + '})(\\d)');
		const m = str.toString().match(re);
		return m ? parseFloat(m[1]) : str;
	}

	async function init({ up, down }) {
		const { syncDb, asyncDb } = await setup();
		syncDb.exec(up);
		await asyncDb({ sql: up });
		return {
			syncDb,
			asyncDb,
			cleanup: async () => {
				syncDb.exec(down);
				await asyncDb({ sql: down });
				syncDb.close();
				await asyncDb({ close: true });
			}
		};
	}
	async function insert() {
		const { cleanup, syncDb, asyncDb } = await init({
			up: `CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));`,
			down: `DROP TABLE t1;`
		});
		const INSERTS = inserts();
		inMemoryResults.insert = measure('in memory - insert with no indexes', () =>
			syncDb.exec(INSERTS)
		);
		workerWrappedOpfsResults.insert = await measureAsync(
			'worker - insert with no indexes',
			async () => await asyncDb({ sql: INSERTS })
		);
		cleanup();
	}
	async function insertTransaction() {
		const { cleanup, syncDb, asyncDb } = await init({
			up: `CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));`,
			down: `DROP TABLE t1;`
		});
		const INSERTS = `BEGIN; ${inserts()} COMMIT;`;
		inMemoryResults.insertTransaction = measure(
			'in memory - insert with no indexes with transactions',
			() => syncDb.exec(INSERTS)
		);
		workerWrappedOpfsResults.insertTransaction = await measureAsync(
			'worker - insert with no indexes in transactions',
			async () => await asyncDb({ sql: INSERTS })
		);
		cleanup();
	}
	async function insertIntoIndexed() {
		const { cleanup, syncDb, asyncDb } = await init({
			up: `
			CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));
      CREATE INDEX IF NOT EXISTS i1 ON t1(a);
      CREATE INDEX IF NOT EXISTS i2 ON t1(b);
      CREATE INDEX IF NOT EXISTS i3 ON t1(c);
			`,
			down: `
      DROP INDEX i1;
      DROP INDEX i2;
      DROP INDEX i3;
			DROP TABLE t1;`
		});
		const INSERTS = inserts();
		inMemoryResults.insertIntoIndexed = measure('in memory - insert with indexes', () =>
			syncDb.exec(INSERTS)
		);
		workerWrappedOpfsResults.insertIntoIndexed = await measureAsync(
			'worker - insert with indexes',
			async () => await asyncDb({ sql: INSERTS })
		);
		cleanup();
	}
	async function insertStatementsIndexedTransaction() {
		const { cleanup, syncDb, asyncDb } = await init({
			up: `
			CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));
      CREATE INDEX IF NOT EXISTS i1 ON t1(a);
      CREATE INDEX IF NOT EXISTS i2 ON t1(b);
      CREATE INDEX IF NOT EXISTS i3 ON t1(c);
			`,
			down: `
      DROP INDEX i1;
      DROP INDEX i2;
      DROP INDEX i3;
			DROP TABLE t1;`
		});
		const INSERTS = `BEGIN; ${inserts()} COMMIT;`;
		inMemoryResults.insertStatementsIndexedTransaction = measure(
			'in memory - insert with indexes in transaction',
			() => syncDb.exec(INSERTS)
		);
		workerWrappedOpfsResults.insertStatementsIndexedTransaction = await measureAsync(
			'worker - insert with indexes in transaction',
			async () => await asyncDb({ sql: INSERTS })
		);
		cleanup();
	}
	async function selectWithoutIndex() {
		const { cleanup, syncDb, asyncDb } = await init({
			up: `CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));`,
			down: `DROP TABLE t1;`
		});
		const INSERTS = `BEGIN; ${inserts(2000)} COMMIT;`;
		syncDb.exec(INSERTS);
		await asyncDb({ sql: INSERTS });

		const SELECTS = selectStatements();
		inMemoryResults.selectWithoutIndex = measure('in memory - select without indexes', () =>
			syncDb.exec(SELECTS)
		);
		workerWrappedOpfsResults.selectWithoutIndex = await measureAsync(
			'worker - select without indexes',
			async () => await asyncDb({ sql: SELECTS })
		);
		cleanup();
	}
	async function selectWithIndex() {
		const { cleanup, syncDb, asyncDb } = await init({
			up: `
			CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100));
      CREATE INDEX IF NOT EXISTS i1 ON t1(a);
      CREATE INDEX IF NOT EXISTS i2 ON t1(b);
      CREATE INDEX IF NOT EXISTS i3 ON t1(c);
			`,
			down: `
      DROP INDEX i1;
      DROP INDEX i2;
      DROP INDEX i3;
			DROP TABLE t1;`
		});
		const INSERTS = `BEGIN; ${inserts(2000)} COMMIT;`;
		syncDb.exec(INSERTS);
		await asyncDb({ sql: INSERTS });

		const SELECTS = selectStatements();
		inMemoryResults.selectWithIndex = measure('in memory - select without indexes', () =>
			syncDb.exec(SELECTS)
		);
		workerWrappedOpfsResults.selectWithIndex = await measureAsync(
			'worker - select without indexes',
			async () => await asyncDb({ sql: SELECTS })
		);
		cleanup();
	}

	function measure(name, benchFn) {
		currentBench = name;
		const t0 = performance.now();
		const r = benchFn();
		const t1 = performance.now();
		currentBench = '';
		return { name, time: t1 - t0, results: r };
	}
	async function measureAsync(name, benchFn) {
		currentBench = name;
		const t0 = performance.now();
		const r = await benchFn();
		const t1 = performance.now();
		currentBench = '';
		return { name, time: t1 - t0, results: r };
	}
	const fnMap = {
		insert,
		insertTransaction,
		insertIntoIndexed,
		insertStatementsIndexedTransaction,
		selectWithoutIndex,
		selectWithIndex
	};

	const inMemoryResults = $state({
		insert: null,
		insertTransaction: null,
		insertIntoIndexed: null,
		insertStatementsIndexedTransaction: null,
		selectWithoutIndex: null,
		selectWithIndex: null
	});

	const workerWrappedOpfsResults = $state({
		insert: null,
		insertTransaction: null,
		insertIntoIndexed: null,
		insertStatementsIndexedTransaction: null,
		selectWithoutIndex: null,
		selectWithIndex: null
	});

	let currentBench = $state('');
	let count = $state(0);
	setInterval(() => count++, 50);
</script>

<h1>count {count}</h1>
<div>
	<div>currently running: {currentBench}</div>
</div>
<table>
	<thead>
		<tr>
			<th>where</th>
			{#each Object.keys(inMemoryResults) as name}
				<th>
					<button
						onclick={() => {
							fnMap[name]();
						}}
					>
						{name}</button
					>
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>in memory</td>
			{#each Object.values(inMemoryResults) as val}
				<td>{val?.time ? trunc(val?.time, 3) : 'N/A'} ms</td>
			{/each}
		</tr>
		<tr>
			<td>worker wrapped opfs</td>
			{#each Object.values(workerWrappedOpfsResults) as val}
				<td>{val?.time ? trunc(val?.time, 3) : 'N/A'} ms</td>
			{/each}
		</tr>
	</tbody>
</table>

<style>
	table {
		width: 100%;
		border-spacing: 0;
	}
	th,
	td {
		text-align: left;
		padding: 4px;
	}
	tbody tr:nth-child(odd) {
		background-color: lightgray;
	}
</style>
