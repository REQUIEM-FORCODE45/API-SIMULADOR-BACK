
const { MongoClient } = require('mongodb');
const config = require('./config'); 
const d = require('./output2.json');
const data = JSON.parse(d);

async function connectDB() {
    try {
        const client = new MongoClient(config.mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            //tlsAllowInvalidHostnames: true,
            //tlsAllowInvalidCertificates: true,
        });        
        await client.connect();
        const {tape, climate, residential, generators, powerflow} = data.gridlabd;
        console.log(tape, climate, residential, generators, powerflow);
        await insertDocument(client, { 
            id_result: '1', 
            id_network: '2',
            id_projec: '3',
            tape: tape,
            climate_result:climate,
            residential_result: residential,
            generators_result: generators,
            powerflow_result: powerflow,
         });
        await client.close();
    } catch (err) {
        console.error('Error al conectar a MongoDB Atlas', err);
    }
}

async function insertDocument(client, document) {
    try {
        const db = client.db('Mongo1');
        const collection = db.collection('results');

        const result = await collection.insertOne(document);
        console.log(`Documento insertado con ID: ${result.insertedId}`);
    } catch (err) {
        console.error('Error al insertar documento', err);
    }
}

connectDB();



