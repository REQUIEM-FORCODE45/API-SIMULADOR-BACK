const User = require('./data/models/user');
const Result = require('./data/models/result');
const Network = require('./data/models/network');
const NetworkGlm = require('./data/models/networkGlm');
const Project = require('./data/models/project');
const NodeLink = require('./data/models/nodeLinks');
const { s1_Livepanel, s2_Livepanel, s3_Livepanel } = require('./data/models/livepanel');
const MongoDatabase = require('./data/database');

const axios = require('axios');
const FormData = require('form-data');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csvtojson = require('csvtojson');
const express = require('express');
const fetch = require('node-fetch'); 
const cors = require('cors');
const app = express();
const http = require('http');
const WebSocket = require('ws');
const { parseComplexToPolar } = require('./helpers/complexUtils');
const { json2glm, glm2json } = require('./helpers/gridlabdModule');
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const mqtt = require("mqtt");

const mqttClient = mqtt.connect({
    host: "35.193.246.15",
    port: 1883
});

const topic = "sensores/datos";

require('dotenv').config();
const dbUrl = process.env.MONGO_URL;
const dbName = process.env.MONGO_DB_NAME;
const API_URL = process.env.API_URL;

function roundTo5(num) {
    return Math.round(num * 1e5) / 1e5;
}

async function glm2json2(data, id){

    const uploadDir = path.join(__dirname, 'uploads', id);
    const token = Math.floor(Math.random() * 2 ** 32).toString(16).padStart(8, "0");
    const response = await axios.get(`${API_URL}/${token}/open`);

    // 1. Leer archivos excepto los de la carpeta 'records'
    const allFiles = fs.readdirSync(uploadDir, { withFileTypes: true });
    const filesToUpload = allFiles.filter(f => f.isFile() || (f.isDirectory() && f.name !== 'records'));
    console.log(filesToUpload);
    // 2. Subir archivos
    for (const file of filesToUpload) {
      const filePath = path.join(uploadDir, file.name);
      const form = new FormData();
      form.append(file.name, fs.createReadStream(filePath));

      await axios.post(`${API_URL}/${token}/upload`, form, {
        headers: form.getHeaders(),
      });
    }

    // 3. Subir el inputData como archivo GLM
    const inputFileName = `entrada_${token}.glm`;
    const inputForm = new FormData();
    inputForm.append(inputFileName, Buffer.from(data), {
      filename: inputFileName,
      contentType: 'application/json',
    });

    await axios.post(`${API_URL}/${token}/upload`, inputForm, {
      headers: inputForm.getHeaders(),
    });

    const respData = await axios.get(`${API_URL}/${token}/run/-C ${inputFileName} -o salida${token}.json`);
    const glmRespData = await axios.get(`${API_URL}/${token}/run/ -C salida${token}.json -o salida${token}.glm`);
    const jsonData = await axios.get(`${API_URL}/${token}/download/salida${token}.json`);
    const glmData = await axios.get(`${API_URL}/${token}/download/salida${token}.glm`);
    
    const {data:errorData} = await axios.get(`${API_URL}/${token}/download/stderr`);
    console.log(respData.data);
    
    axios.get(`${API_URL}/${token}/close`);

    //{ json: jsonData.data.content , ...respData.data , ...errorData }

    return  { json: jsonData.data.content , glm:glmData.data.content ,status: respData.data.status , content: errorData.content };
}


function modifyFiles(data, filePath) {
    for (const key in data) {
        if (data[key].class === "multi_recorder" || data[key].class === "recorder") {
            const nameParts = data[key].file.split('/');
            console.log("\n" + nameParts[nameParts.length - 1] + "\n");
            data[key].file = path.join(filePath, nameParts[nameParts.length - 1]);
        }
    }
    return data;
}


///Incio del caos


app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true },{ limit: '25mb' }));
//app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors({
    origin: 'http://localhost:5173', // Allow your frontend's origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Specify allowed methods
    allowedHeaders: ['x-token', 'Content-Type', 'Authorization'], // Allow the x-token header
    credentials: true // If you need to send cookies or authentication tokens
  }));


MongoDatabase.connect(dbUrl, dbName);

app.use('/api/auth', require('./routes/auth'));

app.post('/', async (req, res) => {
    console.log(req.body);


    const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
    };

    fetch('http://localhost:5000/test', requestOptions)
        .then(response => {
            if (!response.ok) {
                throw new Error('Hubo un problema al realizar la petición: ' + response.status);
            }
            return response.json(); 
        })
        .then( async body => {
            res.send(body);        
        })
        .catch(error => {
            console.error('No se pudo conectar con el servidor:', error);
            res.status(500).send('Error al conectar con el servidor'); 
        });
});


// Configuración de multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Usaremos una carpeta temporal inicialmente
        const uploadPath = path.join('uploads', 'temp');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage,limits: {
    fieldSize: 25 * 1024 * 1024
  }, dest: 'temp/' }  
);

app.post('/create-project', upload.array('files'), async (req, res) => {
    try {
        console.log('Cuerpo de la solicitud:', req.body);
        console.log('Archivos recibidos:', req.files);

        // Crear la network
        const newNetwork = await Network.create({
            network_name: req.body.network_name || '',
            application: req.body.application || '',
            version: req.body.version || '',
            modules: req.body.modules ? JSON.parse(req.body.modules) : {},
            types: req.body.types ? JSON.parse(req.body.types) : {},
            header: req.body.header ? JSON.parse(req.body.header) : {},
            classes: req.body.classes ? JSON.parse(req.body.classes) : {},
            globals: req.body.globals ? JSON.parse(req.body.globals) : {},
            schedules: req.body.schedules ? JSON.parse(req.body.schedules) : {},
            objects: req.body.objects ? JSON.parse(req.body.objects) : {},
        });

        // Crear el proyecto
        const newProject = await Project.create({
            id_user: req.body.id,
            id_network: newNetwork._id,
            project_name: req.body.project_name,
            description: req.body.description,
        });

        //Guardar el archivo glm
        const newNetworkGlm = await NetworkGlm.create({
            id_project: newProject._id,
            id_user: req.body.id,
            id_network: newNetwork._id,
            glm: req.body.glm
        })

        // Mover archivos a la carpeta con el network_id
        const networkFolder = path.join('uploads', newNetwork._id.toString());
        fs.mkdirSync(networkFolder, { recursive: true });

        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                const oldPath = file.path;
                const newPath = path.join(networkFolder, file.filename);
                fs.renameSync(oldPath, newPath);
            });
        }

        res.status(201).json({
            message: 'Network y proyecto creados exitosamente',
            network: newNetwork,
            project: newProject
        });
    } catch (error) {
        console.error('Error al crear la network y el proyecto:', error);
        res.status(500).send('Error al crear la network y el proyecto');
    }
});

app.delete('/delete-network/:networkId', async (req, res) => {
    try {
        const { networkId } = req.params;

        // Buscar la red por su ID
        const network = await Network.findById(networkId);
        if (!network) {
            return res.status(404).json({ message: 'Network no encontrada' });
        }

        // Buscar todos los proyectos asociados a esta red
        const projects = await Project.find({ id_network: networkId });

        // Eliminar todos los proyectos asociados de la base de datos
        await Project.deleteMany({ id_network: networkId });

        // Eliminar la red de la base de datos
        await Network.findByIdAndDelete(networkId);

        // Eliminar la carpeta de archivos asociada a la red
        const networkFolder = path.join('uploads', networkId.toString());
        if (fs.existsSync(networkFolder)) {
            fs.rmSync(networkFolder, { recursive: true, force: true });
        }

        res.status(200).json({
            message: 'Network y proyectos asociados eliminados exitosamente',
            deletedProjects: projects.map(p => p._id), // Opcional: incluye los IDs de los proyectos eliminados
        });
    } catch (error) {
        console.error('Error al eliminar la network y sus proyectos asociados:', error);
        res.status(500).json({ message: 'Error al eliminar la network y sus proyectos asociados' });
    }
});

app.delete('/delete-project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;

        // Buscar el proyecto por su ID
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Proyecto no encontrado' });
        }

        // Buscar la red asociada al proyecto
        const networkId = project.id_network;
        const network = await Network.findById(networkId);
        if (!network) {
            return res.status(404).json({ message: 'Network asociada no encontrada' });
        }

        // Eliminar el proyecto de la base de datos
        await Project.findByIdAndDelete(projectId);

        // Eliminar la red de la base de datos
        await Network.findByIdAndDelete(networkId);

        // Eliminar la carpeta de archivos asociada a la red
        const networkFolder = path.join('uploads', networkId.toString());
        if (fs.existsSync(networkFolder)) {
            fs.rmSync(networkFolder, { recursive: true, force: true });
        }

        res.status(200).json({ message: 'Proyecto y network eliminados exitosamente' });
    } catch (error) {
        console.error('Error al eliminar el proyecto y la network:', error);
        res.status(500).json({ message: 'Error al eliminar el proyecto y la network' });
    }
});

app.get('/results', async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;  
    try {
        const results = await Result.find().limit(limit);
        res.status(200).json(results);
    } catch (error) {
        console.error('Error al obtener los resultados:', error);
        res.status(500).send('Error al obtener los resultados');
    }
});



app.get('/results/:id', async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;  
    try {
        const result = await Result.findById(req.params.id).limit(limit);
        if (!result) {
            return res.status(404).send('Resultado no encontrado');
        }
        res.status(200).json(result);
    } catch (error) {
        console.error('Error al obtener el resultado:', error);
        res.status(500).send('Error al obtener el resultado');
    }
});



app.get('/networks', async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;  // Limitar los resultados a 10 por defecto
    try {
        const networks = await Network.find().limit(limit);
        res.status(200).json(networks);
    } catch (error) {
        console.error('Error al obtener los resultados:', error);
        res.status(500).send('Error al obtener los resultados');
    }
});

app.put('/updateNetwork/:id', async (req, res) => {
    try {

        const id = req.params.id;
        const updatedNetwork = await Network.findById(id); // Buscar la red

        if (!updatedNetwork) {
            return res.status(404).send('Network no encontrada');
        }
        

        // Aplicar los cambios del body
        updatedNetwork.set(req.body);



        /*    
        const updatedNetwork = await Network.findByIdAndUpdate(
            req.params.id, // El ID de la network que vamos a actualizar
            { $set: req.body }, // Los datos nuevos para la network
            { new: true, runValidators: true } // Opciones: retornar el documento actualizado y validar el nuevo esquema
        );
        
        

        if (!updatedNetwork) {
            return res.status(404).send('Network no encontrada');
        }*/

        const excluir = ["_id", "network_name", "__v"];

        const resultado = {
          ...Object.fromEntries(
            Object.entries(updatedNetwork._doc).filter(([key]) => !excluir.includes(key))
          )
        };

        const uploadDir = path.join(__dirname, 'uploads', id);
        const token = Math.floor(Math.random() * 2 ** 32).toString(16).padStart(8, "0");
        const response = await axios.get(`${API_URL}/${token}/open`);
  
        // 1. Leer archivos excepto los de la carpeta 'records'
        const allFiles = fs.readdirSync(uploadDir, { withFileTypes: true });
        const filesToUpload = allFiles.filter(f => f.isFile() || (f.isDirectory() && f.name !== 'records'));
        console.log(filesToUpload);

        // 2. Subir archivos
        for (const file of filesToUpload) {
          const filePath = path.join(uploadDir, file.name);
          const form = new FormData();
          form.append(file.name, fs.createReadStream(filePath));
    
          await axios.post(`${API_URL}/${token}/upload`, form, {
            headers: form.getHeaders(),
          });
        }

  
        // 3. Subir el inputData como archivo JSON
        const inputFileName = `entrada_${token}.json`;
        const inputForm = new FormData();
        inputForm.append(inputFileName, Buffer.from(JSON.stringify(resultado)), {
          filename: inputFileName,
          contentType: 'application/json',
        });
    
        await axios.post(`${API_URL}/${token}/upload`, inputForm, {
          headers: inputForm.getHeaders(),
        });
  
        const responseSim = await axios.get(`${API_URL}/${token}/run/-C ${inputFileName} -o salida${token}.glm`);
        const glmData = await axios.get(`${API_URL}/${token}/download/salida${token}.glm`);
        axios.get(`${API_URL}/${token}/close`);

        if(responseSim.data.status !== "ERROR"){
            // Buscar y actualizar el documento correspondiente
            const updatedGlm = await NetworkGlm.findOneAndUpdate(
                { id_network: id },
                { $set: { glm: glmData.data.content } },
                { new: true } // Retornar el documento actualizado
            );

            if (!updatedGlm) {
                return res.status(404).send('Red no encontrada para actualizar');
            } 
            await updatedNetwork.save();
            res.status(200).json(updatedNetwork); // Retornamos la network actualizada

        }else{
            res.status(500).json({status: responseSim.data.status, content: responseSim.data.content});
        }
          
    } catch (error) {
        console.error('Error al actualizar la network:', error);
        res.status(500).send('Error al actualizar la network');
    }
});


app.get('/networks/:id', async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;  // Limitar los resultados a 10 por defecto
    try {
        const network = await Network.findById(req.params.id).limit(limit);
        if (!network) {
            return res.status(404).send('Resultado no encontrado');
        }
        res.status(200).json(network);
    } catch (error) {
        console.error('Error al obtener el resultado:', error);
        res.status(500).send('Error al obtener el resultado');
    }
});


app.get('/projects', async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;  // Limitar los resultados a 10 por defecto
    try {
        const projects = await Project.find().limit(limit);
        res.status(200).json(projects);
    } catch (error) {
        console.error('Error al obtener los resultados:', error);
        res.status(500).send('Error al obtener los resultados');
    }
});


app.get('/glm/:id', async (req, res) => {
    try {
        
        // Obtener la red en formato JSON desde la base de datos  
        
        const network = await NetworkGlm.find({ id_network: req.params.id });
        console.log(network);
        if (!network) {
            return res.status(404).send('Resultado no encontrado');
        }

        //const glmOutput = await json2glm(JSON.stringify(network), req.params.id);

        // Procesar la respuesta de la API de Flask
        if (network) {
            //const data = await response.json();
            res.status(200).json(network[0]); // Enviar solo el GLM convertido
        } else {
            res.status(500).send('Error en la conversión de JSON a GLM');
        }

    } catch (error) {
        console.error('Error al obtener y convertir el contenido GLM:', error);
        res.status(500).send('Error al obtener y convertir el contenido GLM');
    }
});

app.post('/updateGlm/:id', upload.array('files'), async (req, res) => {
    try {
        const id = req.params.id;
        const updatedData = req.body.glm;
 

        // Buscar y actualizar el documento correspondiente
        const updatedNetwork = await NetworkGlm.findOneAndUpdate(
            { id_network: id },
            { $set: { glm: updatedData } },
            { new: true } // Retornar el documento actualizado
        );

        if (!updatedNetwork) {
            return res.status(404).send('Red no encontrada para actualizar');
        }

        res.status(200).json({
            message: 'Red GLM actualizada correctamente',
            data: updatedNetwork
        });
    } catch (error) {
        console.error('Error al actualizar el contenido GLM:', error);
        res.status(500).send('Error al actualizar el contenido GLM');
    }
});


app.post('/addglm/:id', async (req, res) => {
    try {
        // Obtener la red en formato JSON desde la base de datos
        const network = await NetworkGlm.find({ id_network: req.params.id });
        if (!network) {
            return res.status(404).send('Resultado no encontrado');
        }             
        glmOutput = network[0].glm;

        if (glmOutput) {
            //let data = await response.json();
            let glmContent = glmOutput; 
            const additionalContent = req.body.additionalContent || ''; 
            const modelsContent     = req.body.modelsContent || ''; 

            // Insertar el contenido dinámico antes del último '}'
            const modulesIndex = glmContent.lastIndexOf('modules');
            if (modulesIndex !== -1) {
                glmContent =
                    glmContent.slice(0, modulesIndex+7) + // Todo el GLM antes del último '}'
                    modelsContent + // Contenido adicional del formulario
                    glmContent.slice(modulesIndex+7); // El último '}'
            }

            const closingBracketIndex = glmContent.lastIndexOf('}');
            if (closingBracketIndex !== -1) {
                glmContent =
                    glmContent.slice(0, closingBracketIndex+1) + // Todo el GLM antes del último '}'
                    '\n' + additionalContent + // Contenido adicional del formulario
                    glmContent.slice(closingBracketIndex+1); // El último '}'
            }



            const jsonOutput = await glm2json2(glmContent, req.params.id);

            if (jsonOutput.status != "ERROR" ) {
                const updatedNetworkJson = await JSON.parse(jsonOutput.json);

                const updatedNetworkGlm = await NetworkGlm.findOneAndUpdate(
                    { id_network: req.params.id },
                    { $set: { glm: jsonOutput.glm } },
                    { new: true } // Retornar el documento actualizado
                );
                                
                // Actualizar la red en la base de datos
                const updatedNetwork = await Network.findByIdAndUpdate(
                    req.params.id, 
                    updatedNetworkJson, // Reemplaza con el JSON actualizado
                    { new: true } // Devuelve el documento actualizado
                );

                if (!updatedNetwork) {
                    return res.status(500).send('Error al actualizar la red en la base de datos');
                }

                console.log('guardado correctamente ' + req.params.id)
            }

            const {status, content} = jsonOutput;            
            res.status(200).send({status, content}); // Enviar el GLM modificado al cliente  


        } else {
            res.status(500).send('Error en la conversión de JSON a GLM');
        }
    } catch (error) {
        console.error('Error al obtener y convertir el contenido GLM:', error);
        res.status(500).send('Error al obtener y convertir el contenido GLM');
    }
});


app.get('/links/:networkId', async (req, res) => {
    try {
        const { networkId } = req.params;

        // Buscar un documento específico por ObjectId
        const document = await Network.findOne({
            _id: networkId, // Buscar por el ObjectId
            'objects': { $exists: true } // Asegurarnos de que exista la propiedad `objects`
        });

        if (!document) {
            return res.status(404).send('Network not found');
        }

        // Arrays para almacenar resultados de links y nodos
        const links = [];
        const nodes = [];

        // Paso 1: Clasificar en links o nodos
        Object.keys(document.objects).forEach(key => {
            const object = document.objects[key];

            // Filtrar solo las clases de interés para links
            if (['overhead_line', 'switch', 'underground_line', 'regulator', 'transformer', 'triplex_line', 'fuse'].includes(object.class)) {
                // Agregar a links
                links.push({
                    label: key,  // El key es el name
                    source: object.from,
                    target: object.to
                });
            } else {
                let polarA, polarB, polarC, nominal;
                if(object.voltage_A){
                    polarA = parseComplexToPolar(object.voltage_A);
                    polarB = parseComplexToPolar(object.voltage_B);
                    polarC = parseComplexToPolar(object.voltage_C);
                    nominal = parseFloat(object.nominal_voltage.trim().replace(/[a-zA-Z\s]+$/g, ''));
                    //[ `voltage A: ${object.voltage_A}`,  `voltage B: ${object.voltage_B}`, `voltage C: ${object.voltage_C}`]
                    //[ polarA.r/nominal, polarB.r/nominal, polarC.r/nominal]
                };

                nodes.push({
                    id: object.guid,  // El key es el id del nodo
                    guid: object.guid, 
                    label: key,  // El key también se usará como label
                    characteristics: (object.voltage_A)?([ {voltage_A:roundTo5(polarA.r/nominal)}, {voltage_B:roundTo5(polarB.r/nominal)}, {voltage_C:roundTo5(polarC.r/nominal)}, {angle_A:roundTo5(polarA.theta)}, {angle_B:roundTo5(polarB.theta)} , {angle_C:roundTo5(polarC.theta)}  ]):([]), // Por ahora vacío
                    x: null,  // Las coordenadas vacías por ahora
                    y: null
                });
            }
        });

        const nodeIdsInLinks = new Set(); 
        console.log(nodes);
        
        links.forEach(link => {
            if (link.source) nodeIdsInLinks.add(link.source);
            if (link.target) nodeIdsInLinks.add(link.target);
        });

        const filteredNodes = nodes.filter(node => nodeIdsInLinks.has(node.label));
        const Nodes = filteredNodes.map((node, index) => ({
            ...node,          
            id: index + 1     
        }));

        // Crear un mapa para reemplazar los IDs de los links
        const nodeMap = {};
        Nodes.forEach(node => {
            nodeMap[node.label] = node.id;
        });

        // Reemplazar los IDs en el array de líneas
        const updatedLines = links.map(line => ({
            ...line,
            source: nodeMap[line.source] || line.source, // Reemplaza el 'from' si existe en el mapeo
            target: nodeMap[line.target] || line.target // Reemplaza el 'to' si existe en el mapeo
        }));

        const outputLN = {
            links: updatedLines,
            nodes: Nodes,
        };

        res.status(200).json(outputLN);

    } catch (error) {
        console.error(error);
        res.status(500).send('Error al obtener los resultados');
    }
});


app.get('/list-csv-files/:projectId', (req, res) => {
    const projectId = req.params.projectId;
    const recordsDir = path.resolve(`uploads/${projectId}/records`);
    
    fs.readdir(recordsDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const csvFiles = files.filter(file => path.extname(file) === '.csv');
        res.json(csvFiles);
    });
});

app.delete('/delete-csv-file/:projectId/:filename', (req, res) => {
    const { projectId, filename } = req.params;
    const filePath = path.resolve(`uploads/${projectId}/records/${filename}`);
    
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }
        
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error al eliminar el archivo:', err);
                return res.status(500).json({ error: 'No se pudo eliminar el archivo' });
            }
            
            res.status(200).json({ message: 'Archivo eliminado exitosamente' });
        });
    });
});

//const upload = multer({ dest: 'temp/' }); // Carpeta temporal para almacenar los archivos antes de moverlos

app.post('/add-file/:projectId', upload.single('file'), (req, res) => {
    const { projectId } = req.params;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
    }

    const destinationDir = path.resolve(`uploads/${projectId}/`);
    const destinationPath = path.join(destinationDir, file.originalname);

    // Crear el directorio si no existe
    fs.mkdir(destinationDir, { recursive: true }, (err) => {
        if (err) {
            console.error('Error al crear el directorio:', err);
            return res.status(500).json({ error: 'No se pudo crear el directorio' });
        }

        // Mover el archivo desde la carpeta temporal
        fs.rename(file.path, destinationPath, (err) => {
            if (err) {
                console.error('Error al mover el archivo:', err);
                return res.status(500).json({ error: 'No se pudo agregar el archivo' });
            }

            res.status(200).json({ message: 'Archivo agregado exitosamente', filename: file.originalname });
        });
    });
});

app.delete('/delete-file/:projectId/:filename', (req, res) => {
    const { projectId, filename } = req.params;
    const filePath = path.resolve(`uploads/${projectId}/${filename}`);
    
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }
        
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error al eliminar el archivo:', err);
                return res.status(500).json({ error: 'No se pudo eliminar el archivo' });
            }
            
            res.status(200).json({ message: 'Archivo eliminado exitosamente' });
        });
    });
});

app.get('/list-files/:projectId', (req, res) => {
    const { projectId } = req.params;
    const directoryPath = path.resolve(`uploads/${projectId}`);

    // Verificamos si el directorio existe
    fs.access(directoryPath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ error: 'Directorio no encontrado' });
        }

        fs.readdir(directoryPath, (err, files) => {
            if (err) {
                console.error('Error al leer los archivos:', err);
                return res.status(500).json({ error: 'Error al leer los archivos' });
            }

            const filteredFiles = files.filter(file => file !== 'records');

            res.status(200).json(filteredFiles);
        });
    });
});

app.get('/get-csv-data/:projectId/:filename', (req, res) => {
    const projectId = req.params.projectId;
    const filename = req.params.filename;
    const filePath = path.resolve(`uploads/${projectId}/records/${filename}`);

    // Leer el archivo CSV
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Filtrar comentarios, pero conservar la última línea de encabezado
        let lines = data.split('\n');
        let header = null;
        let filteredLines = [];
        let lastCommentIndex = -1;

        lines.forEach((line, index) => {
            if (line.startsWith('#')) {
                // Encontrar la última línea que comienza con '#'
                if(index < 10){
                    lastCommentIndex = index;
                }
                console.log(index);
            } else {
                filteredLines.push(line);
            }
        });

        // Conservar la última línea que comienza con '#', que tiene los encabezados
        if (lastCommentIndex > -1 && lines[lastCommentIndex]) {
            header = lines[lastCommentIndex];
        }

        // Si hay una línea de encabezado, añadirla al inicio
        if (header) {
            filteredLines.unshift(header.replace(/^#\s*/, ''));
        }
        const filteredData = filteredLines.join('\n');
        console.log(header);
        // Convertir CSV a JSON
        csvtojson()
            .fromString(filteredData)
            .then(jsonData => {
                res.json(jsonData);
            })
            .catch(err => {
                res.status(500).json({ error: err.message });
            });
    });
});

app.get('/projectsList/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        // Buscar los proyectos por el id_user
        const projects = await Project.find({ id_user: userId }, '_id project_name id_network description'); // Solo selecciona los campos relevantes

        console.log(projects);    
        // Mapear los proyectos para devolver el formato requerido
        const formattedProjects = projects.map(project => ({
            label: project.project_name,      
            to: `/GraphNetwork/${project.id_network}`,   
        }));

        res.status(200).json(formattedProjects);

    } catch (error) {
        console.error('Error al obtener los proyectos del usuario:', error);
        res.status(500).send('Error al obtener los proyectos del usuario');
    }
});

app.get('/api/livepanel', async (req, res) => {
    try {
      // Obtener los parámetros de fecha desde y hasta
      const { desde, hasta } = req.query;
      console.log("Fechas recibidas:", { desde, hasta });
  
      // Validar si los parámetros existen
      if (!desde || !hasta) {
        return res.status(400).json({ error: "Los parámetros 'desde' y 'hasta' son requeridos" });
      }
  
      // Convertir las fechas a objetos Date
      const startDate = new Date(desde);
      const endDate = new Date(hasta);
      console.log("Fechas convertidas a Date:", { startDate, endDate });
  
      // Validar que las fechas sean válidas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Las fechas proporcionadas son inválidas" });
      }
  
      // Ajustar las horas para incluir todo el rango del día
      startDate.setSeconds(0, 0);
      endDate.setSeconds(59, 999);
      console.log("Rango final de fechas:", { startDate, endDate });
  
      // Consultar los datos de cada sensor
      const s1Data = await s1_Livepanel.find({
        timestamp: { $gte: startDate, $lte: endDate }
      }).sort({ timestamp: 1 });
      
      const s2Data = await s2_Livepanel.find({
        timestamp: { $gte: startDate, $lte: endDate }
      }).sort({ timestamp: 1 });
      
      const s3Data = await s3_Livepanel.find({
        timestamp: { $gte: startDate, $lte: endDate }
      }).sort({ timestamp: 1 });
  
      console.log("Datos encontrados:", {
        s1: s1Data.length,
        s2: s2Data.length,
        s3: s3Data.length
      });
  
      // Enviar la respuesta identificando los datos de cada sensor
      res.status(200).json({ s1Data, s2Data, s3Data });
      
    } catch (error) {
      console.error("Error al obtener los datos de Livepanel:", error);
      res.status(500).json({ error: "Error al obtener los datos" });
    }
});

app.post('/json2glm', async (req, res) => {
    try {
        const { id, json: dataJson } = req.body;
        const glmOutput = await json2glm(JSON.stringify(dataJson), id);
        res.json({ glm: glmOutput});
    } catch (error) {
        console.error('Error in json2glm:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/glm2json', async (req, res) => {
    try {
        const { id, glm: dataGlm } = req.body;
        const jsonOutput = await glm2json(dataGlm, id);
        res.json(JSON.parse(jsonOutput));
    } catch (error) {
        console.error('Error in glm2json:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/uploadFiles/:id/:toke', async (req, res) => {
    try{
        const id = req.params.id;
        const tokenU = req.params.toke;
        const uploadDir = path.join(__dirname, 'uploads', id);
        // 1. Leer archivos excepto los de la carpeta 'records'
        const allFiles = fs.readdirSync(uploadDir, { withFileTypes: true });
        const filesToUpload = allFiles.filter(f => f.isFile() || (f.isDirectory() && f.name !== 'records'));
        console.log(filesToUpload);
        // 2. Subir archivos
        for (const file of filesToUpload) {
            const filePath = path.join(uploadDir, file.name);
            const form = new FormData();
            form.append(file.name, fs.createReadStream(filePath));
            await axios.post(`${API_URL}/${tokenU}/upload`, form, {
                headers: form.getHeaders(),
            });
        }

        res.json({status: 'OK'});

    }catch (error){

        res.json({status: 'ERROR'});

    }

});

app.post('/test', async (req, res) => {
     
      let { id, inputData } = req.body;
      const uploadDir = path.join(__dirname, 'uploads', id);
      const token = Math.floor(Math.random() * 2 ** 32).toString(16).padStart(8, "0");
      console.log(token);
      const response = await axios.get(`${API_URL}/${token}/open`);

      // 1. Leer archivos excepto los de la carpeta 'records'
      const allFiles = fs.readdirSync(uploadDir, { withFileTypes: true });
      const filesToUpload = allFiles.filter(f => f.isFile() || (f.isDirectory() && f.name !== 'records'));
      console.log(filesToUpload);
      // 2. Subir archivos
      for (const file of filesToUpload) {
        const filePath = path.join(uploadDir, file.name);
        const form = new FormData();
        form.append(file.name, fs.createReadStream(filePath));
  
        await axios.post(`${API_URL}/${token}/upload`, form, {
          headers: form.getHeaders(),
        });
      }

      const dirPath = path.join(__dirname, 'uploads', id, 'records');      

      const inputObs = modifyFiles(inputData.objects , dirPath);
      inputData.objects = inputObs;

      // 3. Subir el inputData como archivo JSON
      const inputFileName = `entrada_${token}.json`;
      const inputForm = new FormData();
      inputForm.append(inputFileName, Buffer.from(JSON.stringify(inputData)), {
        filename: inputFileName,
        contentType: 'application/json',
      });
  
      await axios.post(`${API_URL}/${token}/upload`, inputForm, {
        headers: inputForm.getHeaders(),
      });

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log('Carpeta creada:', dirPath);
      } else {
        console.log('La carpeta ya existe:', dirPath);
      }

      await axios.get(`${API_URL}/${token}/run/${inputFileName} -o salida${token}.json`);
      const jsonData = await axios.get(`${API_URL}/${token}/download/salida${token}.json`);
      axios.get(`${API_URL}/${token}/close`);

      res.json(JSON.parse(jsonData.data.content));
    /*
    } catch (error) {
      console.error('Error in /test:', error.message);
      res.status(500).json({ error: error.message });
    }*/
});

app.get('/testLinks/:networkId', async (req, res) => {

    try {
        
        const { networkId:id } = req.params;
        const inputData = await Network.findOne({
            _id: id, 
            'objects': { $exists: true } 
        },
        {
            application: 1,
            version: 1,
            modules: 1,
            types: 1,
            header: 1,
            classes: 1,
            globals: 1,
            schedules: 1,
            objects: 1,
            _id: 0 
        });

        const uploadDir = path.join(__dirname, 'uploads', id);
        const token = Math.floor(Math.random() * 2 ** 32).toString(16).padStart(8, "0");
        console.log(token);
        const response = await axios.get(`${API_URL}/${token}/open`);

        // 1. Leer archivos excepto los de la carpeta 'records'
        const allFiles = fs.readdirSync(uploadDir, { withFileTypes: true });
        const filesToUpload = allFiles.filter(f => f.isFile() || (f.isDirectory() && f.name !== 'records'));
        console.log(filesToUpload);
        // 2. Subir archivos
        for (const file of filesToUpload) {
        const filePath = path.join(uploadDir, file.name);
        const form = new FormData();
        form.append(file.name, fs.createReadStream(filePath));

        await axios.post(`${API_URL}/${token}/upload`, form, {
            headers: form.getHeaders(),
        });
        }

        const dirPath = path.join(__dirname, 'uploads', id, 'records');      

        const inputObs = modifyFiles(inputData.objects , dirPath);
        inputData.objects = inputObs;

        // 3. Subir el inputData como archivo JSON
        const inputFileName = `entrada_${token}.json`;
        const inputForm = new FormData();
        inputForm.append(inputFileName, Buffer.from(JSON.stringify(inputData)), {
        filename: inputFileName,
        contentType: 'application/json',
        });

        await axios.post(`${API_URL}/${token}/upload`, inputForm, {
        headers: inputForm.getHeaders(),
        });

        if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log('Carpeta creada:', dirPath);
        } else {
        console.log('La carpeta ya existe:', dirPath);
        }

        await axios.get(`${API_URL}/${token}/run/${inputFileName} -o salida${token}.json`);
        const jsonData = await axios.get(`${API_URL}/${token}/download/salida${token}.json`);
        axios.get(`${API_URL}/${token}/close`);

        //res.json();
        // Arrays para almacenar resultados de links y nodos
        const document = JSON.parse(jsonData.data.content);

        const links = [];
        const nodes = [];

        // Paso 1: Clasificar en links o nodos
        Object.keys(document.objects).forEach(key => {
            const object = document.objects[key];

            // Filtrar solo las clases de interés para links
            if (['overhead_line', 'switch', 'underground_line', 'regulator', 'transformer', 'triplex_line', 'fuse'].includes(object.class)) {
                // Agregar a links
                links.push({
                    label: key,  // El key es el name
                    source: object.from,
                    target: object.to
                });
            } else {
                let polarA, polarB, polarC, nominal;
                if(object.voltage_A){
                    polarA = parseComplexToPolar(object.voltage_A);
                    polarB = parseComplexToPolar(object.voltage_B);
                    polarC = parseComplexToPolar(object.voltage_C);
                    nominal = parseFloat(object.nominal_voltage.trim().replace(/[a-zA-Z\s]+$/g, ''));
                    //[ `voltage A: ${object.voltage_A}`,  `voltage B: ${object.voltage_B}`, `voltage C: ${object.voltage_C}`]
                    //[ polarA.r/nominal, polarB.r/nominal, polarC.r/nominal]
                };

                nodes.push({
                    id: object.guid,  // El key es el id del nodo
                    guid: object.guid,
                    label: key,  // El key también se usará como label
                    characteristics: (object.voltage_A)?([ {voltage_A:roundTo5(polarA.r/nominal)}, {voltage_B:roundTo5(polarB.r/nominal)}, {voltage_C:roundTo5(polarC.r/nominal)}, {angle_A:roundTo5(polarA.theta)}, {angle_B:roundTo5(polarB.theta)} , {angle_C:roundTo5(polarC.theta)}   ]):([]), // Por ahora vacío
                    x: null,  // Las coordenadas vacías por ahora
                    y: null
                });
            }
        });

        // Paso 2: Filtrar los nodos que están en `to` o `from` de cualquier link
        const nodeIdsInLinks = new Set(); // Usamos Set para evitar duplicados
        console.log(nodes);
        
        links.forEach(link => {
            if (link.source) nodeIdsInLinks.add(link.source);
            if (link.target) nodeIdsInLinks.add(link.target);
        });

        // Filtrar el array de nodos para quedarnos solo con los que están en `nodeIdsInLinks`
        const filteredNodes = nodes.filter(node => nodeIdsInLinks.has(node.label));
        const Nodes = filteredNodes.map((node, index) => ({
            ...node,          // Mantener las otras propiedades del objeto
            id: index + 1     // Reemplazar el id con una secuencia comenzando desde 1
        }));

        // Crear un mapa para reemplazar los IDs de los links
        const nodeMap = {};
        Nodes.forEach(node => {
            nodeMap[node.label] = node.id;
        });

        // Reemplazar los IDs en el array de líneas
        const updatedLines = links.map(line => ({
            ...line,
            source: nodeMap[line.source] || line.source, // Reemplaza el 'from' si existe en el mapeo
            target: nodeMap[line.target] || line.target // Reemplaza el 'to' si existe en el mapeo
        }));

        const outputLN = {
            links: updatedLines,
            nodes: Nodes,
        };

        res.status(200).json(outputLN);

    } catch (error) {
        console.error('Error in /testLinks:', error.message);
        res.status(500).json({ error: error.message });
    }

});

app.get('/nodelinks/:id', async (req, res) => {
    try {
        const nodeLink = await NodeLink.findOne({ id_network: req.params.id });
        if (!nodeLink) {
            return res.status(404).send('NodeLink no encontrado');
        }
        res.status(200).json(nodeLink);
    } catch (error) {
        console.error('Error al obtener el NodeLink:', error);
        res.status(500).send('Error al obtener el NodeLink');
    }
});


app.put('/nodelinks/:id', async (req, res) => {
    try {
        const { nodes, links, id_user } = req.body;
        const id_network = req.params.id;

        const updated = await NodeLink.findOneAndUpdate(
            { id_network },
            {
                $set: { nodes, links },
                $setOnInsert: {
                    id_network,
                    id_user: id_user || null
                }
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
            }
        );

        res.status(200).json(updated);
    } catch (error) {
        console.error('Error al actualizar o crear el NodeLink:', error);
        res.status(500).send('Error al actualizar o crear el NodeLink');
    }
});


app.delete('/nodelinks/:id', async (req, res) => {
    try {
        const deleted = await NodeLink.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).send('NodeLink no encontrado');
        }
        res.status(200).send('NodeLink eliminado correctamente');
    } catch (error) {
        console.error('Error al eliminar el NodeLink:', error);
        res.status(500).send('Error al eliminar el NodeLink');
    }
});


mqttClient.on("connect", () => {
    console.log("Conectado al broker MQTT");
    mqttClient.subscribe(topic, (err) => {
        if (err) {
            console.error("Error al suscribirse al topic:", err);
        }
    });
});

mqttClient.on("message", async (topic, message) => {
    try {
       
        const data = JSON.parse(message.toString());
        const { s1, s2, s3 } = data;
        if (s1 && s2 && s3) {

            const s1_panel = new s1_Livepanel(s1);
            const s2_panel = new s2_Livepanel(s2);
            const s3_panel = new s3_Livepanel(s3);

            await s1_panel.save();
            await s2_panel.save();
            await s3_panel.save();

            /*
            const livePanelEntry = new Livepanel({
                voltaje,
                corriente,
                factor_potencia,
                fase
            });

            await livePanelEntry.save();
            console.log("Datos guardados en MongoDB:", livePanelEntry);*/

            // Enviar datos por WebSocket a todos los clientes conectados
            
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });

            //console.log('Mensaje recibido');

        } else {
            console.warn("Datos incompletos recibidos. No se guardarán.");
        }
    } catch (err) {
        console.error("Error al procesar o guardar el mensaje:", err);
    }
});

wss.on("connection", (ws) => {
    console.log("Cliente WebSocket conectado");
    
    ws.on("message", (message) => {
        try {
            const relayState = JSON.parse(message);
            const relayString = JSON.stringify(relayState);
            mqttClient.publish("control/reles", relayString, (err) => {
                if (err) {
                    console.error("Error al publicar en MQTT:", err);
                } else {
                    //console.log("Mensaje publicado en control/reles:", relayString);
                }
            });
        } catch (error) {
            console.error("Error parseando el mensaje:", error);
        }
    });

    ws.on("close", () => {
        console.log("Cliente WebSocket desconectado");
    });
});

server.listen( process.env.PORT, () => {
    console.log('Servidor escuchando en el puerto 3000');
});
