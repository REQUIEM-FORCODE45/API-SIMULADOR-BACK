const User = require('./data/models/user');
const Result = require('./data/models/result');
const Network = require('./data/models/network');
const Project = require('./data/models/project');
const MongoDatabase = require('./data/database');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csvtojson = require('csvtojson');
const express = require('express');
const fetch = require('node-fetch'); 
const cors = require('cors');
const app = express();

require('dotenv').config();
const dbUrl = process.env.MONGO_URL;
const dbName = process.env.MONGO_DB_NAME;


app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
    origin: 'http://localhost:5173'
}));



MongoDatabase.connect(dbUrl, dbName);
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
  } }  
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
            id_network: newNetwork._id,
            project_name: req.body.project_name,
            description: req.body.description,
        });

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


app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000');
});
