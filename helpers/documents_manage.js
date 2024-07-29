const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const app = express();
const port = 3000;

// Configuración de CORS
app.use(cors({ origin: 'http://localhost:5173' }));

// Configuración de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectPath = path.join(__dirname, 'uploads', req.body.projectName);
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }
    cb(null, projectPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage }).array('files');

// Middleware para parsear el body de la solicitud
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint para manejar la subida
app.post('/upload', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      console.error('Error handling file upload:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('Files received:', req.files);
    console.log('Project name:', req.body.projectName);
    res.json({ message: 'Archivos subidos con éxito', files: req.files });
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error handling request:', err.message);
  res.status(500).json({ error: err.message });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
