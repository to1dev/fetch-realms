DROP TABLE IF EXISTS _realms2;

CREATE TABLE IF NOT EXISTS _realms2 (
    RealmName TEXT PRIMARY KEY NOT NULL,
    RealmId TEXT NOT NULL UNIQUE,
    RealmNumber INTEGER NOT NULL UNIQUE,
    RealmMintTime INTEGER NOT NULL,
    RealmMinter TEXT NOT NULL,
    RealmOwner TEXT NOT NULL,
    ProfileId TEXT
);
