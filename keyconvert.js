const fs = require("fs");

const json = fs.readFileSync(
  "./final-project-b153e-firebase-adminsdk-fbsvc-82684be840"
);

const base64 = Buffer.from(json).toString("base64");

console.log(base64);