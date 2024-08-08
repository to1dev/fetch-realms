DROP TABLE IF EXISTS _realms;

CREATE TABLE IF NOT EXISTS _realms (
    RealmName TEXT PRIMARY KEY NOT NULL,
    RealmId TEXT NOT NULL UNIQUE,
    RealmNumber INTEGER NOT NULL UNIQUE,
    RealmMinter TEXT NOT NULL,
    RealmOwner TEXT NOT NULL,
    ProfileId TEXT
);
