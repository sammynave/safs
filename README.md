Architecture

Why a read and write DB?
  - in mem db allows us to minimize latency
  - syncronous interface, minimize use of await in app code. NO SPINNERS/LOADING STATE
  - we can even keep app state in there, it should be fast enough. then we can have a unified store


- CRDT column that lives in write DB and is materialized as tables in the in memory (read) db

- Read replica DB in memory and in main thread
  - create and use a prepared statements cache
  - UI will read from this DB so we get ~1ms queries
  - reactive queries will hook up to this one
  - this will need to be seeded from write when page refreshes
  - i think maybe we'll project CRDT changes to this DB
    as tables so we can write regular SQL queries
  - when a CRDT write happens, we'll write to the write DB
    and simultaneously materialize it to this in memory db
- Write (and persistent) DB in worker thread
  - this table will have all of the CRDT column writes
  - when they change, we'll project that to the in memory db tables