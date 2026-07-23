const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());

// ✅ Firebase init (guard against re-initializing on hot reload / multiple invocations)
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(
        Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
    );
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

// ✅ Middleware: verify firebase token
const verifyFBToken = async (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).send({ message: 'Unauthorized Access' });
    }
    try {
        const idtoken = token.split(' ')[1];
        const decoded = await admin.auth().verifyIdToken(idtoken);
        req.decoded_email = decoded.email;
        next();
    } catch (err) {
        return res.status(403).send({ message: 'Forbidden Access' });
    }
};

const uri = `mongodb://${process.env.USER_NAME}:${process.env.USER_PASS}@ac-od9nzj2-shard-00-00.ivkpyx5.mongodb.net:27017,ac-od9nzj2-shard-00-01.ivkpyx5.mongodb.net:27017,ac-od9nzj2-shard-00-02.ivkpyx5.mongodb.net:27017/?tls=true&authSource=admin&retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

// ✅ Serverless-safe DB connection (connect once, reuse across invocations)
let isConnected = false;
let database, paymentCullactoon, userCullactoon, RiderCullactoon;

async function connectDB() {
    if (isConnected) return;
    await client.connect();
    database = client.db('newDatabase').collection('data');
    paymentCullactoon = client.db('newDatabase').collection('payment');
    userCullactoon = client.db('newDatabase').collection('user');
    RiderCullactoon = client.db('newDatabase').collection('rider');

    await client.db('admin').command({ ping: 1 });
    isConnected = true;
    console.log('✅ Successfully connected to MongoDB!');
}

// Ensure DB is connected before handling any request
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error('❌ DB Connection Error:', error.message);
        res.status(500).send({ message: 'Database connection failed' });
    }
});

const verifyAdmin = async (req, res, next) => {
    const email = req.decoded_email;
    const query = { email };
    const user = await userCullactoon.findOne(query);

    if (!user || user.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden: Admins only' });
    }
    next();
};

// ✅ Health check (root route so Vercel doesn't 404 on "/")
app.get('/', (req, res) => {
    res.send('🚀 Server is running');
});

// ✅ Add New user
app.post('/user', async (req, res) => {
    try {
        const email = req.body.email;
        const userExist = await userCullactoon.findOne({ email });

        if (userExist) {
            return res.status(200).send({ message: 'User already exists' });
        }

        const userInfo = req.body;
        const result = await userCullactoon.insertOne(userInfo);
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Get users (search)
app.get('/user', async (req, res) => {
    try {
        const searchText = req.query.searchText;
        const query = {};
        if (searchText) {
            query.$or = [
                { DisPlayName: { $regex: searchText, $options: 'i' } },
                { email: { $regex: searchText, $options: 'i' } },
            ];
        }

        const result = await userCullactoon.find(query).toArray();
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Get role (admin/user/rider)
app.get('/user/:email/role', verifyFBToken, async (req, res) => {
    try {
        const email = req.params.email;
        const query = { email };
        const user = await userCullactoon.findOne(query);
        res.send({ role: user?.role || 'user' });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Update user role
app.patch('/user/:id/role', verifyFBToken, verifyAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const updateInfo = req.body;
        const query = { _id: new ObjectId(userId) };

        const updateDoc = {
            $set: {
                role: updateInfo.role,
            },
        };
        const result = await userCullactoon.updateOne(query, updateDoc);
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Rider insert (apply)
app.post('/rider', async (req, res) => {
    try {
        const rider = req.body;
        rider.status = 'pending';
        rider.createdAt = new Date();
        const result = await RiderCullactoon.insertOne(rider);
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Rider delete application
app.delete('/rider/:id', verifyFBToken, async (req, res) => {
    try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await RiderCullactoon.deleteOne(query);
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Rider find
app.get('/rider', async (req, res) => {
    try {
        const { status, senderRegion } = req.query;
        const query = {};

        if (status) query.status = status;
        if (senderRegion) query.senderRegion = senderRegion;

        const result = await RiderCullactoon.find(query).toArray();
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Rider set status (also updates user role to 'rider')
app.patch('/rider/:id', verifyFBToken, verifyAdmin, async (req, res) => {
    try {
        const status = req.body.status;
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const updateDocs = {
            $set: { status: status },
        };
        const result = await RiderCullactoon.updateOne(query, updateDocs);

        // update user's role too
        const email = req.body.email;
        if (email) {
            const userQuery = { email };
            const updateUserRole = {
                $set: { role: 'rider' },
            };
            await userCullactoon.updateOne(userQuery, updateUserRole);
        }

        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Add parcel/application
app.post('/applications', async (req, res) => {
    try {
        const data = req.body;
        const result = await database.insertOne(data);
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Delete application
app.delete('/applications/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await database.deleteOne(query);
        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Update application (assign rider)
app.patch('/applications/:id', async (req, res) => {
    try {
        const { riderId, riderEmail, riderName } = req.body;
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };

        const updateDocs = {
            $set: {
                deliveryStatas: 'rider-assigned',
                riderId: riderId,
                riderEmail: riderEmail,
                riderName: riderName,
            },
        };
        const result = await database.updateOne(query, updateDocs);

        // update rider work status
        const riderQuery = { _id: new ObjectId(riderId) };
        const riderUpdate = {
            $set: { workstatus: 'in-delivery' },
        };
        await RiderCullactoon.updateOne(riderQuery, riderUpdate);

        res.send(result);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Get all applications (filterable)
app.get('/applications', async (req, res) => {
    try {
        const query = {};
        const { email, deliveryStatas } = req.query;

        if (email) query.email = email;
        if (deliveryStatas) query.deliveryStatas = deliveryStatas;

        const parcels = await database.find(query).toArray();
        res.send(parcels);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Get single application by id
app.get('/applications/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await database.findOne(query);
        res.send(result);
    } catch (err) {
        console.log(err);
        res.status(500).send({ message: err.message });
    }
});

// ✅ Payment history
app.get('/paymentstatas', verifyFBToken, async (req, res) => {
    try {
        const userEmail = req.query.email;

        if (userEmail !== req.decoded_email) {
            return res.status(403).send({ message: 'Forbidden Access' });
        }

        const query = userEmail ? { email: userEmail } : {};
        const options = {
            sort: { paidAt_string: -1 },
        };
        const payments = await paymentCullactoon.find(query, options).toArray();
        res.send(payments);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Record payment + update parcel status
app.post('/paymentstatas', async (req, res) => {
    try {
        const { parcelid, email, amount, paymentMethod, transactionId } = req.body;
        await database.updateOne(
            { _id: new ObjectId(parcelid) },
            {
                $set: {
                    payment_statas: 'paid',
                    deliveryStatas: 'pending-pickup',
                },
            }
        );
        const paymentDoc = {
            parcelid,
            email,
            amount,
            paymentMethod,
            transactionId,
            paidAt_string: new Date().toISOString(),
        };
        const paymentResult = await paymentCullactoon.insertOne(paymentDoc);
        res.send(paymentResult);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// ✅ Create stripe payment intent
app.post('/create-payment-intent', async (req, res) => {
    try {
        const price = req.body.amount;
        const amount = Math.round(price * 100);
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

// ✅ Local dev only — Vercel handles the server itself via the exported app
if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`🚀 Server is running locally on port ${port}`);
    });
}

module.exports = app;
