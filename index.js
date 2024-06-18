const express = require('express');
const fetch = require('node-fetch'); 
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.post('/', (req, res) => {
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
        .then(body => {
            //console.log(body);
            res.send(body);
        })
        .catch(error => {
            console.error('No se pudo conectar con el servidor:', error);
            res.status(500).send('Error al conectar con el servidor'); 
        });
});

app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000');
});
