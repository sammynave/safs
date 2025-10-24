/*
 * What are we doing?
 *
 *
 * db.create()
 * db.migrate.up()
 * db.migrate.down()
 * db.query()
 * db.subscribe(db.query())
 */

/* eslint-disable */
// @ts-nocheck

class DB {}
class Store {}

// probably want this as export fns for treeshaking
class DDL {
	static Table(options) {}
	static Text(options) {}
	static Enum(options) {}
}

// this resolves to JSON.
// the DDL methods are just helpers to reduce boilerplate
const safsSchema = DDL.Schema({
	users: DDL.Table({
		name: 'users',
		sync: true,
		columns: {
			id: DDL.Text({ nullable: false, pk: true }),
			name: DDL.Text({ nullable: false })
		}
	}),
	todos: DDL.Table({
		name: 'todos',
		sync: true,
		columns: {
			id: DDL.Text({ nullable: false, pk: true }),
			user_id: DDL.Text({ nullable: false }), // maybe ad fk constraints someday :shrug:
			todo: DDL.Text({ nullable: false }),
			status: DDL.Enum({
				enums: { complete: 'complete', incomplete: 'incomplete' },
				default: 'incomplete'
			})
		}
	})
});

const safsAppSchema = DDL.Schema({
	// This could be UI state
	// e.g. scroll position, form values, etc...
	// we don't need to save this to the write DB
	// and it shouldn't be synced (most of the time)
	ui_state: DDL.Table({
		name: 'ui_state',
		sync: false,
		colunns: {
			is_modal_open: DDL.Bool({ default: false })
		}
	})
});

const options = {
	name: 'safs',
	storage: 'opfs',
	type: 'non-blocking',
	schema: safsSchema
	// this converts any changes to the CRDT meta table to INSERTs, UPDATEs, CREATEs, DELETEs, etc...
	// if 'self' is the option, we also create the queryable tables, not just the CRDT metadata table
	// when used in conjuction with an in-memory store (like the read below), we could omit this if
	// we only ever write and never plan to run any queries directly on this db.
	// materializeFrom: ['self']
};
const writeDb = DB.create(options);

const readOptions = {
	name: 'safs-view',
	storage: 'memory',
	type: 'blocking',
	// this converts any changes to the CRDT meta table to INSERTs, UPDATEs, CREATEs, DELETEs, etc...
	// it only works if writeDb is the same schema or contains the schema of this db
	// materialize from will hook into the reactivity system of DB
	materializeFrom: [writeDb],
	schema: safsSchema.union(safsAppSchema)
};
const readDb = DB.create(options);

const store = Store.create({
	write: writeDb,
	read: readDb
});

let todos = $state([]);
/* at some point, this should become a view that's updated with IVM.
 * initially, i guess we just re-run the query when one of it's deps change
 * deps =>
 *  - watch whole table if there's no where clause and re-run when it changes
 *  - when there's a where clause, and the field is UNIQUE, we watch that one column
 *    and only re-run when it changes
 *  - if it's an INSERT, check against query deps to see if we need to re-run
 */
const unsubscribe = store.subscribe(
	store.select(['id', 'name', 'completed']).from('users'),
	(r) => (todos = r)
);

// somewhere in the app
store.tx((tx) => {
	const userId = crypto.randomUUID();
	const todoId = crypto.randomUUID();
	tx.insert({ id: userId, name: 'sammy' }).into('users');
	tx.insert({ id: todoId, todo: 'dishes', user_id: userId }).into('todos');
});

/* the above transactions maps to these CRDT events below
	- site_id: Unique id of the device/database (e.g. Alice’s phone).
	- column_name: Which column changed (title, status, etc.).
	- row_key: Encoded primary key (points back to the row in todo).
	- column_version: A Lamport clock or hybrid logical clock (HLC) that totally orders changes from the same site.
	- db_version: The current database-wide Lamport clock, used to detect if a peer has already seen this change.
	- op_type: Flag describing if this is an insert/update/delete at the column level (some systems call this a “tombstone” or “causal length”).
	- seq: Order of mutations within the same db_version (to preserve local transaction order).
*/

// see https://vlcn.io/docs/cr-sqlite/api-methods/crsql_changes for inspiration

// the inserts in the write db look like this
const result = store.write.tx((tx) => {
	insert({
		site_id: tx.store.siteId,
		table: 'users',
		column_name: 'id',
		row_key: userId,
		value: userId,
		column_version: 0,
		db_version: 1,
		table_version: 0,
		op_type: 'insert',
		seq: 0
	}).into('changes');
	insert({
		site_id: tx.store.siteId,
		column_name: 'name',
		table: 'users',
		row_key: userId,
		value: 'sammy',
		column_version: 0,
		db_version: 1,
		table_version: 0,
		op_type: 'insert',
		seq: 1
	}).into('changes');
	insert({
		site_id: tx.store.siteId,
		column_name: 'id',
		table: 'todos',
		row_key: todoId,
		value: todoId,
		column_version: 0,
		db_version: 1,
		table_version: 0,
		op_type: 'insert',
		seq: 2
	}).into('changes');
	insert({
		site_id: tx.store.siteId,
		table: 'todos',
		column_name: 'user_id',
		row_key: todoId,
		value: userId,
		column_version: 0,
		db_version: 1,
		table_version: 0,
		op_type: 'insert',
		seq: 3
	}).into('changes');
	insert({
		site_id: tx.store.siteId,
		table: 'todos',
		column_name: 'todo',
		row_key: todoId,
		value: 'dishes',
		column_version: 0,
		db_version: 1,
		table_version: 0,
		op_type: 'insert',
		seq: 4
	}).into('changes');
	insert({
		site_id: tx.store.siteId,
		table: 'todos',
		column_name: 'status',
		row_key: todoId,
		value: 'incomplete',
		column_version: 0,
		db_version: 1,
		table_version: 0,
		op_type: 'insert',
		seq: 5
	}).into('changes');

	// Update version metadata
	// materializers will use this to get the latest
	update('versions')
		.set('db', 2)
		.set('users', 1)
		.set('users.name', 1)
		.set('todos', 1)
		.set('todos.status', 1)
		.set('todos.todo', 1)
		.set('todos.user_id', 1);
	// Order
	updated('versions', {
		db: 2,
		users: 1,
		'users.name': 1,
		todos: 1,
		'todos.status': 1,
		'todos.todo': 1,
		'todos.user_id': 1
	});
});

/*
 * Without waiting for those writes, run the actual query that was passed in
 * and any reactive subscribers update immediately.
 */
store.read.tx((tx) => {
	tx.insert({ id: userId, name: 'sammy' }).into('users');
	tx.insert({ id: todoId, todo: 'dishes', user_id: userId }).into('todos');
});

/*
 * in the background, once the writes to the CRDT table happen on the write db, we run
 * any materializers (these are functions that map CRDT updates to SQL inserts/updates/creates/deletes on the read db)
 * here, we can validate that the results equal or do not equal the current value in the read db.
 * if they are the same, do nothing
 * if they are different apply them by running the generated SQL on the read db and thus trigger any subscribers
 *
 * most of the time, it should be a noop for local changes. the materializers will mostly be used to generate changes
 * to the read db that come int from other clients/peers
 */
store.read.materialize(result);

/* Syncing
 *
 * eventually, we will need to track peers, the latest value we've sent and the latest value we've seen from them
 *
 *  if [version] === 0, that means send the whole database
 *
  CREATE TABLE crsql_tracked_peers(
  	[site_id] BLOB NOT NULL,
  	[version] INTEGER NOT NULL,
  	[tag] INTEGER,
  	[event] INTEGER,
  	PRIMARY KEY ([site_id], [tag], [event])
	) STRICT;
 */
