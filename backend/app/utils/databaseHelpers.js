const db = require( "../models" );

/**
 * returns a list of all the emails in the database, with the number of times they appear in each
 * field, and the last time they were used
 * @returns An array of objects with the following properties:
 * address, name, transactional, newsletter, conversation, from, to, cc, bcc, reply_to, body, date
 */
async function getEmails( userId ) {
    const data = await db.emailsRaw.findAll( {
        "where": { "user_id": userId },
        "attributes": [
            "address",
            [
                db.sequelize.literal(
                    'json_agg(DISTINCT name) FILTER ( WHERE "name" = \'\' IS FALSE)'
                ),
                "name"
            ],
            [
                db.sequelize.literal( 'COUNT(*) FILTER (WHERE "conversation" = \'1\')' ),
                "conversation"
            ],
            [
                db.sequelize.literal( 'COUNT (*) FILTER ( WHERE "from" = \'true\' )' ),
                "from"
            ],

            [
                db.sequelize.literal( 'COUNT (*) FILTER ( WHERE "body" = \'true\' )' ),
                "body"
            ],

            [
                db.sequelize.fn(
                    "SUM",
                    db.sequelize.literal(
                        'CASE WHEN "bcc" = \'true\' OR "cc" = \'true\' OR "to" = \'true\' THEN 1 ELSE 0 END '
                    )
                ),
                "recipient"
            ],
            [
                db.sequelize.fn(
                    "EVERY",
                    db.sequelize.literal(
                        'CASE WHEN  "from" = \'true\'  AND "transactional" = \'true\'  THEN true ELSE false END '
                    )
                ),
                "Transactional"
            ],
            [
                db.sequelize.fn(
                    "EVERY",
                    db.sequelize.literal(
                        'CASE WHEN  "from" = \'true\'  AND "newsletter" = \'true\'  THEN true ELSE false END '
                    )
                ),
                "Newsletter"
            ],
            [
                db.sequelize.fn(
                    "SUM",
                    db.sequelize.literal(
                        'CASE WHEN "from" = \'true\' OR "reply_to" = \'true\' THEN 1 ELSE 0 END '
                    )
                ),
                "sender"
            ],
            "domain_type",

            [ db.sequelize.literal( "MAX(date)" ), "date" ]
        ],
        "group": [ "address", "domain_type" ]
    } );

    return data;
}
/**
 * getCountDB returns the number of emails in the database for a given user
 * @param userId - The user's ID.
 * @returns The number of emails in the database for a given user.
 */
async function getCountDB( userId ) {
    const count = await db.emailsRaw.count( {
        "where": { "user_id": userId }
    } );

    return count;
}

/**
 * Delete all the emails for a user.
 * @param userId - The user's ID.
 * @returns The number of rows deleted.
 */
async function deleteUserData( userId ) {
    return db.emailsRaw.destroy( {
        "where": { "user_id": userId }
    } );
}

module.exports = { getEmails, getCountDB, deleteUserData };
