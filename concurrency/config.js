const config = {
    host:'127.0.0.1',
    port:3000,
    db:{
        localhost:'127.0.0.1',
        port:5432,
        user:'postgres',
        password:'admin', //ideally this should be a env variable, hardcoded for exercise purposes
        database:'postgres',
    },
    redis:{
        host:'127.0.0.1',
        port:6379
    }
};   

module.exports = config;