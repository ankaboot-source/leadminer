const config = require( "config" ),
    POSTGRES_DB = config.get( "server.postgres.name" ) ? config.get( "server.postgres.name" ) : process.env.POSTGRES_DB,
    POSTGRES_PASSWORD = config.get( "server.postgres.password" ) ? config.get( "server.postgres.password" ) : process.env.POSTGRES_PASSWORD,
    POSTGRES_USER = config.get( "server.postgres.user" ) ? config.get( "server.postgres.user" ) : process.env.POSTGRES_USER,
    POSTGRES_HOST = config.get( "server.postgres.host" ) ? config.get( "server.postgres.host" ) : process.env.POSTGRES_HOST;

/* Exporting the database information to be used in the server.js file. */
module.exports = {
    "db": POSTGRES_DB,
    "password": POSTGRES_PASSWORD,
    "user": POSTGRES_USER,
    "host": POSTGRES_HOST
};
