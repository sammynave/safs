
Simplified approach - Every change is stored as a message in a messages table with:

- timestamp (from HLC)
- dataset (table name)
- row (encoded primary keys)
- column
- value

another example: https://vlcn.io/docs/cr-sqlite/api-methods/crsql_changes
- table - this is the name of the CRR that the current change applies to
- pk - the primary key columns for that table, encoded in a format that can be sent over the wire and validated on receipt.
- cid - the name of the column that was modified. Special values are used in the case of deletes and creates.
- val - the value of the column. Encoded for safe wire transport and validation on receipt.
- col_version - version / lamport clock of the column. Used for merging.
- db_version - the lamport clock of the database. Used to track whether or not a site has seen changes from another database.
- site_id - the site responsible for the change
- cl - "causal length" or whether or not the row is deleted
- seq - the order within the given db_version the mutation was made. Useful for splitting up very large transactions into many packets.

Applying a message is as simple as:

- Look up the current value
- If the incoming timestamp is newer → overwrite
- If it’s older → ignore

This guarantees convergence across devices, regardless of the sync order.

sources
https://marcobambini.substack.com/p/why-local-first-apps-havent-become
https://marcobambini.substack.com/p/the-secret-life-of-a-local-first


CRDTs typically track each column independently so that two peers can edit different columns of the same row without overwriting each other.

For our INSERT, the engine conceptually turns it into three “column insertions”:

(row=ID1, column=title, value=’Buy groceries’)
(row=ID1, column=status, value=’in_progress’)
(row=ID1, column=id, value=’ID1’) (implicit for primary key)
- Each column is then annotated with causal metadata.


Metadata captured per column

For every column change, the engine typically stores:

- site_id: Unique id of the device/database (e.g. Alice’s phone).
- column_name: Which column changed (title, status, etc.).
- row_key: Encoded primary key (points back to the row in todo).
- column_version: A Lamport clock or hybrid logical clock (HLC) that totally orders changes from the same site.
- db_version: The current database-wide Lamport clock, used to detect if a peer has already seen this change.
- op_type: Flag describing if this is an insert/update/delete at the column level (some systems call this a “tombstone” or “causal length”).
- seq: Order of mutations within the same db_version (to preserve local transaction order).


Sync: how Bob receives Alice’s change

When Alice later syncs with Bob (via any transport like HTTP, P2P, etc.):

1. Diff calculation:
  A. P2P mode:
    - Alice asks Bob: “What db_version have you seen from me?”
    - Bob replies with the last db_version he knows for Alice’s site_id.
    - Alice then ships only the ops with db_version > Bob’s reply.

  B. Server-orchestrated mode:
    - Instead of talking directly, Alice contacts a sync service. The server keeps a version map (per-site_id last-seen db_version) for every client.
    - Alice uploads her new ops; the server updates Alice’s entry.
    - When Bob syncs, the server tells him which db_versions from each site he’s missing and streams just those ops.
    - This centralizes fan-out, simplifies conflict-free catch-up, and avoids NAT/P2P issues while preserving CRDT semantics.

2. Operation shipping:
  - Alice sends all new rows in metadata_table beyond that version.

3. Replay:
  Bob’s engine replays the ops in causal order:
  - If the row doesn’t exist, it creates it.
  - It writes the columns in the same order Alice used (seq).
  - It updates Bob’s local clock table so he doesn’t reapply the same ops later.
  - After the replay, Bob’s user-facing todo table looks exactly like Alice’s.