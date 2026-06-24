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



        // app.get('/applications', async (req, res) => {
        //     // সব ডাটা দেখার জন্য
        //     const allParcels = await client.db('newDatabase').collection('data').find({}).toArray();
        //     console.log('All parcels in DB:', allParcels); // এটা দেখুন
        //     res.send(allParcels);
        // });


        app.get('/applications', async (req, res) => {
            const userEmail = req.query.email;

            const query = userEmail ? { email: userEmail } : {};

            const parcels = await database.find(query).toArray();
            res.send(parcels);
        });

        app.delete('/applications/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }

            const result = database.deleteOne(query)
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
        app.get('/applications', async (req, res) => {
            const result = await database.find().toArray()
            res.send(result)
        })




        app.post('/create-payment-intent', async (req, res) => {
            try {
                const price = req.body.amount;
                console.log(price)

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