const {Pool} = require('pg')
const config = require('./config')
const pool = new Pool({
    host:config.db.localhost,
    port:config.db.port,
    user:config.db.user,
    password:config.db.password,
    database:config.db.database,
    max:20,
    idleTimeoutMillis:30000,
    connectionTimeoutMillis:2000,
});

pool.on('error',(err)=>{
    console.error(err);
})

module.exports = pool