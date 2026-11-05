# Lost Update: pessimistic vs optimistic locking

When two transactions read the same record and both write to it, one update silently overwrites the other. This is a lost update.
I built a small exercise to see how the two common fixes, pessimistic and optimistic locking, behave as the number of concurrent transactions grows.

## The project

A tiny service with one `products` table (quantity plus a version column, `updt_cnt`).
Placing an order decrements the quantity, and it can do that in two ways:

- **Pessimistic:** lock the row, check the quantity, write, commit. Competing transactions wait.
- **Optimistic:** read without locking, then write only if `updt_cnt` is still the value that was read. If not, the write fails and the caller retries.

Each transaction also makes a simulated 50 ms external call (think of a payment), so slow work inside a transaction has a visible cost.

## The test script

`npm run race` fires concurrent transactions at 2, 5, 10 and 20 volumes and compares the time taken in each mode:

1. **No conflict:** every transaction works on a different record.
2. **Conflict:** every transaction works on the same record. Optimistic is run two ways: retries that repeat the external call, and retries that only repeat the quick write after the external call was made once.


It also prints how many retries (wasted external calls) optimistic needed.

## What I saw

No Conflict
<img width="928" height="220" alt="image" src="https://github.com/user-attachments/assets/7b02d0e5-3175-4fb1-ad3f-51a766b25d06" />

Conflict
<img width="1306" height="182" alt="image" src="https://github.com/user-attachments/assets/e40d4d77-0131-4004-923d-da36b01effa2" />

Neither approach wins everywhere. With no conflicts the two are about the same. With many transactions on one record, pessimistic avoids wasted work, and optimistic does best when its retries don't repeat the slow part.
