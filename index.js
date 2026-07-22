const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();
const { getAuth } = require("firebase-admin/auth");



const admin = require("firebase-admin");

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString("utf8")
);
console.log(admin);
admin.initializeApp({
   credential: admin.cert(serviceAccount),
});


// ✅ Stripe
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

        req.decoded_email = decoded.email;

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


async function run() {
    try {
        await client.connect();

        const database = client.db('newDatabase').collection('data')
        const paymentCullactoon = client.db('newDatabase').collection('payment')
        const userCullactoon = client.db('newDatabase').collection('user')
        const RiderCullactoon = client.db('newDatabase').collection('rider')

        const variFyAdmin = async (req, res, next) => {
            const email = req.decoded_email
            const quary = { email }
            const user = await userCullactoon.findOne(quary)

            if (!user || user.role !== 'admin') {
                return res.status(403).send({ message: 'you are a Bot' })
            }

            next()
        }

        // ✅ Add New user in user cullaction
        app.post('/user', async (req, res) => {
            const email = req.body.email;
            const userExist = await userCullactoon.findOne({ email })

            if (userExist) { return res.status(200).send({ message: 'User already exists' }) }

            const userInfo = req.body;
            const result = await userCullactoon.insertOne(userInfo);
            res.send(result)
        })
        // ✅ Sand New user in user cullaction
        app.get('/user', async (req, res) => {
            const searchText = req.query.searchText;
            const quary = {};
            if (searchText) {
                // quary.DisPlayName = {$regex: searchText , $options: 'i'};
                quary.$or = [
                    { DisPlayName: { $regex: searchText, $options: 'i' } },
                    { email: { $regex: searchText, $options: 'i' } },
                ]
            }

            const result = await userCullactoon.find(quary).toArray()
            res.send(result)
        })
        // ✅ Find role    admin/user/rider
        app.get('/user/:email/role', verifyFBToken, async (req, res) => {
            const email = req.params.email;
            const quary = { email }
            const user = await userCullactoon.findOne(quary)
            res.send({ role: user?.role || 'user' })
        })
        // ✅ Updat User status in user cullaction
        app.patch('/user/:id/role', verifyFBToken, variFyAdmin, async (req, res) => {
            const userId = req.params.id
            const upDatInfo = req.body
            const quary = { _id: new ObjectId(userId) }

            const carsor = {
                $set: {
                    role: upDatInfo.role
                }
            }
            const result = await userCullactoon.updateOne(quary, carsor)
            res.send(result)
        })

        //✅ Rider insart
        app.post('/rider', async (req, res) => {
            const rider = req.body;
            rider.status = 'panding'
            rider.createdAt = new Date()
            const result = await RiderCullactoon.insertOne(rider)
            res.send(result)
        })
        //✅ Rider Delet Apply
        app.delete('/rider/:id', verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const quary = { _id: new ObjectId(id) }
            const result = await RiderCullactoon.deleteOne(quary)
            res.send(result)
        })
        // ✅Rider find
        app.get('/rider', async (req, res) => {
            const {status,senderRegion} = req.query;

            const query = {}

            if (status) {
                query.status = status
            }
            if(senderRegion){
                query.senderRegion = senderRegion
            }
            

            const result = await RiderCullactoon.find(query).toArray()
            res.send(result)
        })
        // ✅Rider set status
        app.patch('/rider/:id', verifyFBToken, variFyAdmin, async (req, res) => {
            const status = req.body.status;
            const id = req.params.id;
            const quary = { _id: new ObjectId(id) }

            const updateDocs = {
                $set: {
                    status: status
                }
            }
            const result = await RiderCullactoon.updateOne(quary, updateDocs)

            // and Updat user Role //
            const email = req.body.email;
            const Userquary = { email }
            const updatUserRol = {
                $set: {
                    role: 'rider'
                }
            }
            //
            const carcor = await userCullactoon.updateOne(Userquary, updatUserRol)
            res.send(result)
        })

        //✅ Add Parcel on detabase
        app.post('/applications', async (req, res) => {
            const data = req.body;
            const result = await database.insertOne(data);
            res.send(result);
        });
        //✅ Delet My Parcel
        app.delete('/applications/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await database.deleteOne(query)
            res.send(result)
        })
        //✅ Updat parcel Data and rider data //
        app.patch('/applications/:id',async(req, res)=>{
            const {riderId, riderEmail, riderName, parcelId} = req.body
            const id = req.params.id;

            const quary = {_id: new ObjectId(id)}

            const updateDocs = {
                $set: {
                    deliveryStatas: 'rider-assinded',
                    riderId: riderId,
                    riderEmail: riderEmail,
                    riderName: riderName

                }
            }
            const result = await database.updateOne(quary,updateDocs)

            //updat rider
            const riderquery = {_id: new ObjectId(riderId)}
            const riderUpdat = {
                $set: {
                    workstatus: 'in-dalivare'
                }
            }
            const riderresult = await RiderCullactoon.updateOne(riderquery,riderUpdat)
            res.send(result)
        })



        // ✅ Send Parcel data in client side 
        app.get('/applications',  async (req, res) => {
            const query =  {};
            const {email, deliveryStatas} = req.query;

            if(email){
                query.email= email;
            }
            if(deliveryStatas){
                query.deliveryStatas = deliveryStatas;
            }


            const parcels = await database.find(query).toArray();
            res.send(parcels);
        });
        // ✅ Send 1 Parcel data in client side with (id)
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



        // ✅ verifyFBToken    //✅Payment history
        app.get('/paymentstatas', verifyFBToken, async (req, res) => {
            const userEmail = req.query.email;

            if (userEmail !== req.decoded_email) {
                return res.status(403).send({ message: 'fuck You' })
            }

            const query = userEmail ? { email: userEmail } : {};
            const options = {
                sort: { paidAt_string: -1 },  //  সঠিক field name
            };
            const payments = await paymentCullactoon.find(query, options).toArray();
            res.send(payments);
        });

        //✔💲💲💲✔ Updat Database And Insart Paymant history in Payment cullacton ✔💲💲💲✔
        app.post('/paymentstatas', async (req, res) => {
            const { parcelid, email, amount, paymentMethod, transactionId } = req.body;
            const updatResult = await database.updateOne(
                { _id: new ObjectId(parcelid) },
                {
                    $set: {
                        payment_statas: 'paid',
                        deliveryStatas: 'panding-picup'
                    }
                }
            )
            const paymentDoc = {
                parcelid, email, amount, paymentMethod, transactionId,
                paidAt_string: new Date().toISOString()
            }
            const paymentResult = await paymentCullactoon.insertOne(paymentDoc)
            res.send(paymentResult)
        })
        // ✔💲💲💲✔ Create strip payment ✔💲💲💲✔
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

        // await client.db("admin").command({ ping: 1 });
        // console.log("Successfully connected to MongoDB!");

        app.listen(port, () => {
            console.log(`🚀 Server is running on port ${port}`);
        });
    } catch (error) {
        console.error("❌ Error:", error.message)
    }
}

run().catch(console.dir);