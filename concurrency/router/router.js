const express = require('express')
const { sendHelloWord, getOrder, placeOrder } = require('../controller/orderController')
const router = express.Router();

router.get('/', sendHelloWord);
router.get('/order/:product_id', getOrder);
router.post('/order', placeOrder);

module.exports = router
