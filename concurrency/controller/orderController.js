const orders = require('../model/orders');

async function sendHelloWord(req, res) {
    res.status(200).send('This is a checkout page; test for Concurrency')
}

// GET /order/:product_id
async function getOrder(req, res) {
    try {
        const product_id = Number(req.params.product_id);
        const data = await orders.getProductsById(product_id);
        console.log(data);
        if (!data) return res.status(404).json({ error: 'Order not found' });
        res.status(200).json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function placeOrder(req, res) {

    try{
        const { product_id, qty } = req.body || {};

        //Place the order
        // PESSIMISTIC LOCKING
        //const result = await orders.updateProductWithLock(product_id,qty);

        // OPTIMISTIC LOCKING
        const result_2 = await orders.updateProduct(product_id,qty)
        
        res.status(200).json({ received_product_id: product_id })
    }
    catch(err){
        if (err.message === 'OUT_OF_STOCK') return res.status(400).json({error:'Out of stock'})
        if (err.message === 'CONFLICT') return res.status(409).json({error:'Conflict, please retry'})
        if (err.message === 'NOT_FOUND') return res.status(404).json({error:'Product not found'})
        console.error(err)
        res.status(500).json({error:'Internal server error'})
    }
}

module.exports = { sendHelloWord, getOrder, placeOrder };
