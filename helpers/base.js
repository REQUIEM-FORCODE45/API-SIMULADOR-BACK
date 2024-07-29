const User = require('../data/models/user');
const Result = require('../data/models/result');
const Network = require('../data/models/network');
const Project = require('../data/models/project');
const MongoDatabase = require('../data/database');

const input = require('./test/input');
const output = require('./test/output3');

require('dotenv').config();
const dbUrl = process.env.MONGO_URL;
const dbName = process.env.MONGO_DB_NAME;


async function main(){
    await MongoDatabase.connect(dbUrl, dbName);

    const newUser =  await User.create({
        name:"david",
        password:".1234"
    });

    const newProject = await Project.create({
        id_network: 1,
        id_project: 2,
        project_name: "4 nodos",
        description: "Una red pequeña perfecta para el analisis",
    });

    const newNetwork = await Network.create({
        id_network:1,
        network_name: "4 nodos",
        clock:input.clock,
        definitions:input.definitions,
        directives:input.directives,
        includes:input.includes,
        modules:input.modules,
        objects:input.objects,
        schedules:input.schedules,
    });

    
    const newResult = await Result.create({
        id_result:1,
        id_network:2,
        id_project:3,
        classes_result:output.classes,
        global_result:output.globals,
        headers_result:output.header,
        modules_result:output.modules,
        objects_result:output.objects,
        schedules_result:output.schedules,
        types_result:output.types,
        version_result:output.version,

    });

    await newUser.save();
    await newProject.save();
    await newNetwork.save();
    await newResult.save();

    console.log(newUser);
    console.log(newProject);
    console.log(newNetwork);
    console.log(newResult);
}

main();