const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

// ✅ firebase-admin সঠিকভাবে import
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const serviceAccount = require("./final-project-b153e-firebase-adminsdk-fbsvc-82684be840.json");

initializeApp({
    credential: cert(serviceAccount)  // ✅
});

// ✅ Stripe
const stripe = require("stripe")(process.env.STRUO_SECRET_KEE);

// middleware
app.use(cors());
app.use(express.json());

// ✅ Middleware
const verifyFBToken = async (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).send({ message: 'Unauthorized Access' })
    }
    try {
        const idtoken = token.split(' ')[1];
        const decoded = await getAuth().verifyIdToken(idtoken);  // ✅
        req.decoded = decoded;
        console.log('decoded id token', decoded)
        next()
    }
    catch (err) {
        return res.status(403).send({ message: 'Forbidden' })
    }
}

const uri = `mongodb://${process.env.USER_NAME}:${process.env.USER_PASS}@ac-od9nzj2-shard-00-00.ivkpyx5.mongodb.net:27017,ac-od9nzj2-shard-00-01.ivkpyx5.mongodb.net:27017,ac-od9nzj2-shard-00-02.ivkpyx5.mongodb.net:27017/?tls=true&authSource=admin&retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

app.get('/', (req, res) => {
    res.send('Server is running');
});

async function run() {
    try {
        await client.connect();

        const database = client.db('newDatabase').collection('data')
        const paymentCullactoon = client.db('newDatabase').collection('payment')
        const userCullactoon = client.db('newDatabase').collection('user')

        app.post('/user', async (req, res) => {
            const email = req.body.email;
            const userExist = await userCullactoon.findOne({ email })
            if (userExist) { return res.status(200).send({ message: 'User already exists' }) }
            const userInfo = req.body;
            const result = await userCullactoon.insertOne(userInfo);
            res.send(result)
        })

        app.get('/applications', async (req, res) => {
            const userEmail = req.query.email;
            const query = userEmail ? { email: userEmail } : {};
            const parcels = await database.find(query).toArray();
            res.send(parcels);
        });

        app.delete('/applications/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await database.deleteOne(query)
            res.send(result)
        })

        app.get('/applications/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const result = await database.findOne(query);
                res.send(result);
            } catch (err) {
                console.log(err);
                res.status(500).send(err.message);
            }
        });

        app.post('/applications', async (req, res) => {
            const data = req.body;
            const result = await database.insertOne(data);
            res.send(result);
        });

        // ✅ verifyFBToken সঠিক নাম
        app.get('/paymentstatas', verifyFBToken, async (req, res) => {
            const userEmail = req.query.email;
            const query = userEmail ? { email: userEmail } : {};
            const options = {
                sort: { paidAt_string: -1 },  // ✅ সঠিক field name
            };
            const payments = await paymentCullactoon.find(query, options).toArray();
            res.send(payments);
        });

        app.post('/paymentstatas', async (req, res) => {
            const { parcelid, email, amount, paymentMethod, transactionId } = req.body;
            const updatResult = await database.updateOne(
                { _id: new ObjectId(parcelid) },
                { $set: { payment_statas: 'paid' } }
            )
            const paymentDoc = {
                parcelid, email, amount, paymentMethod, transactionId,
                paidAt_string: new Date().toISOString()
            }
            const paymentResult = await paymentCullactoon.insertOne(paymentDoc)
            res.send(paymentResult)
        })

        app.post('/create-payment-intent', async (req, res) => {
            try {
                const price = req.body.amount;
                const amount = price * 100;
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card'],
                });
                res.json({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        await client.db("admin").command({ ping: 1 });
        console.log("✅ Successfully connected to MongoDB!");

        app.listen(port, () => {
            console.log(`🚀 Server is running on port ${port}`);
        });

    } catch (error) {
        console.error("❌ Error:", error.message)  // ✅ error দেখান
    }
}

run().catch(console.dir);