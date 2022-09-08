/* This is creating a table in the database. */
module.exports = ( sequelize, Sequelize ) => {
    const googleUsers = sequelize.define( "google_users", {
        "id": {
            "allowNull": false,
            "primaryKey": true,
            "type": Sequelize.DataTypes.STRING
        },
        "email": {
            "type": Sequelize.STRING
        },
        "refreshToken": {
            "type": Sequelize.STRING
        }
    } );

    return googleUsers;
};
