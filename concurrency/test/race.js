const db = require('../db');
const orders = require('../model/orders');

const HOT_PRODUCT = 1;          // everyone buys this one in the conflict case
const SPREAD_START = 1001;      // ids 1001.. are test products, one per user, in the no-conflict case
const VOLUMES = [2, 5, 10, 20];

// make sure the test products exist
async function createTestProducts() {
    for (let i = 0; i < 20; i++) {
        await db.query(
            `INSERT INTO products (product_id, product_name, price, quantity, updt_cnt)
             VALUES ($1, 'Test Product', 10.00, 1, 0)
             ON CONFLICT (product_id) DO NOTHING`,
            [SPREAD_START + i]
        );
    }
}

async function deleteTestProducts() {
    await db.query('DELETE FROM products WHERE product_id BETWEEN $1 AND $2', [SPREAD_START, SPREAD_START + 19]);
}

async function resetStock(productIds, stock) {
    await db.query('UPDATE products SET quantity=$1, updt_cnt=0 WHERE product_id = ANY($2::int[])', [stock, productIds]);
}

// pessimistic: waits for the row lock, never retries
async function buyPessimistic(productId) {
    await orders.updateProductWithLock(productId, 1);
    return 0;
}

// optimistic: on CONFLICT try again (and pay again, because the payment is inside updateProduct)
async function buyOptimistic(productId) {
    let retries = 0;
    while (true) {
        try {
            await orders.updateProduct(productId, 1);
            return retries;
        } catch (err) {
            if (err.message !== 'CONFLICT') throw err;
            retries++;
        }
    }
}

// optimistic, pay once: pay first, then only the quick write is retried
async function buyOptimisticPayOnce(productId) {
    await orders.fakePayment();
    let retries = 0;
    while (true) {
        try {
            await orders.updateProduct(productId, 1, true);
            return retries;
        } catch (err) {
            if (err.message !== 'CONFLICT') throw err;
            retries++;
        }
    }
}

// productIds has one entry per user
async function runTest(productIds, buyFn) {
    await resetStock(productIds, productIds.length);    // enough stock for everyone
    const start = Date.now();

    const requests = [];
    for (const productId of productIds) {
        requests.push(buyFn(productId));                 // all users start at the same time
    }
    const retryCounts = await Promise.all(requests);

    let totalRetries = 0;
    for (const count of retryCounts) {
        totalRetries += count;
    }
    return { time: Date.now() - start, retries: totalRetries };
}

function sameProduct(users) {
    const ids = [];
    for (let i = 0; i < users; i++) ids.push(HOT_PRODUCT);
    return ids;
}

function differentProducts(users) {
    const ids = [];
    for (let i = 0; i < users; i++) ids.push(SPREAD_START + i);
    return ids;
}

async function main() {
    try {
        await createTestProducts();

        // open the connections first so the first test doesn't pay for it
        const warmup = [];
        for (let i = 0; i < 20; i++) {
            warmup.push(db.query('SELECT 1'));
        }
        await Promise.all(warmup);

        console.log('\nCASE 1: NO CONFLICT (every user buys a different product)');
        console.log('users | pessimistic | optimistic');
        for (const users of VOLUMES) {
            const pess = await runTest(differentProducts(users), buyPessimistic);
            const opt = await runTest(differentProducts(users), buyOptimistic);
            console.log(`${users} | ${pess.time} ms | ${opt.time} ms`);
        }

        console.log('\nCASE 2: CONFLICT (every user buys the same product)');
        console.log('users | pessimistic | optimistic | optimistic pay-once | wasted payments (optimistic)');
        for (const users of VOLUMES) {
            const pess = await runTest(sameProduct(users), buyPessimistic);
            const opt = await runTest(sameProduct(users), buyOptimistic);
            const once = await runTest(sameProduct(users), buyOptimisticPayOnce);
            console.log(`${users} | ${pess.time} ms | ${opt.time} ms | ${once.time} ms | ${opt.retries}`);
        }
        console.log('');
    } catch (err) {
        console.error(err);
    } finally {
        await resetStock([HOT_PRODUCT], 1);
        await deleteTestProducts();
        await db.end();
    }
}

main();
