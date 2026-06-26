const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

// strip
const stripe = require("stripe")(process.env.STRUO_SECRET_KEE);


// middleware
app.use(cors());
app.use(express.json());

// const uri = "mongodb+srv://Zap-shipt-server:502XXq4b0vzd0M1S@cluster0.ivkpyx5.mongodb.net/?appName=Cluster0";




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

        // Read Current Parcel and sand Parcel data // find width:- {email}
        app.get('/applications', async (req, res) => {
            const userEmail = req.query.email;

            const query = userEmail ? { email: userEmail } : {};

            const parcels = await database.find(query).toArray();
            res.send(parcels);
        });
        // Delet Parcel
        app.delete('/applications/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }

            const result = await database.deleteOne(query)
            res.send(result)
        })
        // Read Current Parcel and sand Parcel data // to:- {id}
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
        app.get('/applications', async (req, res) => {
            const result = await database.find().toArray()
            res.send(result)
        })



        // Read or sand paymant history
        app.get('/paymentstatas', async (req, res) => {
            try {
                const userEmail = req.query.email;
                const query = userEmail ? { email: userEmail } : {};

                const options = {
                    sort: { paid_at: -1, }, // Latest first
                };
                const payments = await paymentCullactoon.find(query, options).toArray();
                res.send(payments);

            } catch (error) {
                console.error('Error fetching payment history:', error);
                res.status(500).send({
                    message: 'Failed to get payments',
                });
            }
        });

        // Add paymant hestory to caymentCullactoon
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

        // strip api // Pay amout //
        app.post('/create-payment-intent', async (req, res) => {
            try {
                const price = req.body.amount;
                const amount = price * 100; // টাকাকে cents এ convert

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





        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("✅ Successfully connected to MongoDB!");

        // Server শুরু করুন
        app.listen(port, () => {
            console.log(`🚀 Server is running on port ${port}`);
        });
    } catch (error) {
        // console.error("❌ MongoDB connection error:", error);
        // // await client.close();
        // console.error("FULL ERROR:");
        // console.error(error);
        // console.error("MESSAGE:", error.message);
        // console.error("STACK:", error.stack);
    }

}

run().catch(console.dir);