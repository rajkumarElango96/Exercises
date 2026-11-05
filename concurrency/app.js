const express = require('express')
const config = require('./config')
const router = require("./router/router")
const app = express();
app.use(express.json());
app.use(router);

app.get('/',(req,res)=>{
    res.status(200).send(JSON.stringify("This is Hello Word"));
})

app.listen(config.port,config.host,()=>{
    console.log(`App runing on http://${config.host}:${config.port}`)
    
})