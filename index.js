const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

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


        app.get('/applications', async (req, res) => {
            const userEmail = req.query.email;

            const query = userEmail ? { email: userEmail } : {};

            const options = {
                sort: { createdAt: -1 }, // Newest first
            };

            const parcels = await database.find(query, { _id: 1, name: 1, price: 1,}).toArray();

            res.send(parcels);
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