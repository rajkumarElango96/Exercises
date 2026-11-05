const db = require('../db');

// Fake payment gateway call (ms). Override with: PAYMENT_MS=100 node app.js
const PAYMENT_MS = Number(process.env.PAYMENT_MS || 50);
const fakePayment = () => new Promise(r => setTimeout(r, PAYMENT_MS));

async function getProductsById(product_id) {
    
    const result = await db.query(
        'SELECT product_id, quantity, updt_cnt FROM products p WHERE p.product_id=$1',
        [product_id]
    );
    return result.rows[0];
}

//PessimisticLock
async function updateProductWithLock(product_id,qty) {
    // 1. Check out a single, dedicated client from the pool
    const client = await db.connect();
    try{
        await client.query('BEGIN')
        const lockSql = 'SELECT quantity FROM products p WHERE p.product_id=$1 FOR UPDATE'
        const currQuantity = (await client.query(lockSql,[product_id])).rows[0].quantity
        
        //Check if the product is not out of stock
        if(currQuantity<qty){
            throw new Error('OUT_OF_STOCK')
        }

        await fakePayment()   // payment call while the row lock is held
        const updateSql = 'UPDATE products SET quantity=quantity-$1 where product_id=$2'
        await client.query(updateSql,[qty,product_id])
        await client.query('COMMIT');
        return "SUCCESS"
    }
    catch(err){
        await client.query('ROLLBACK')
        throw err
    }finally{
        client.release()
    }
    
}

//OptimisticLock
async function updateProduct(product_id,qty,alreadyPaid) {
    const client = await db.connect()
    try{
        await client.query('BEGIN')
        const res = await client.query('SELECT product_id, quantity, updt_cnt FROM products WHERE product_id=$1',[product_id])
        if(!res.rows.length){throw new Error('NOT_FOUND')}
        const {quantity, updt_cnt} = res.rows[0]
        if(quantity<qty)
        {
            throw new Error('OUT_OF_STOCK')
        }
        if(!alreadyPaid){ await fakePayment() }   // payment call, no lock held; a conflict below means this payment was wasted
        // only succeeds if nobody changed the row since we read it (same updt_cnt)
        const updateLockSql = 'UPDATE products SET quantity=quantity-$2, updt_cnt=updt_cnt+1 WHERE product_id=$1 AND updt_cnt=$3'
        const upd = await client.query(updateLockSql,[product_id,qty,updt_cnt])
        if(upd.rowCount===0){throw new Error('CONFLICT')}
        await client.query('COMMIT')
        return "SUCCESS"
    }
    catch(err){
        await client.query('ROLLBACK')
        throw err
    }
    finally{
        client.release()
    }
}
module.exports = { getProductsById,updateProduct,updateProductWithLock,fakePayment };
