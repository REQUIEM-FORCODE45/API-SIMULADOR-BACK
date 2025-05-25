const express = require('express');
const { execSync } = require('child_process');

const app = express();
const port = 3000;

// Configura Express para manejar JSON y form-urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint para ejecutar comandos
app.get('/execute', (req, res) => {
  try {
    const command = req.query.command;
    if (!command) {
      return res.status(400).json({ error: 'Necesitas proporcionar un comando' });
    }
    
    // Ejecuta el comando
    const output = execSync(command, { encoding: 'utf8' });
    res.json({
      success: true,
      output: output.trim()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Inicia el servidor
app.listen(port, () => {
  console.log(`API está escuchando en http://localhost:${port}`);
});
