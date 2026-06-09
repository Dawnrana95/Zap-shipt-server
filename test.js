// const { MongoClient } = require("mongodb");

// const uri = "mongodb://Zap-shipt-server:502XXq4b0vzd0M1S@ac-od9nzj2-shard-00-00.ivkpyx5.mongodb.net:27017,ac-od9nzj2-shard-00-01.ivkpyx5.mongodb.net:27017,ac-od9nzj2-shard-00-02.ivkpyx5.mongodb.net:27017/?tls=true&authSource=admin&retryWrites=true&w=majority";

// async function run() {
//   try {
//     const client = await MongoClient.connect(uri, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });

//     console.log("Connected!");
//     await client.db("admin").command({ ping: 1 });
//     console.log("Ping success!");
//     client.close();
//   } catch (err) {
//     console.error(err);
//   }
// }

// run();