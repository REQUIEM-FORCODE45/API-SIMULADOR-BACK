const fs = require('fs').promises;
const { spawn} = require('child_process');
const path = require('path');
const crypto = require('crypto');

// Generar un identificador único
function generateUniqueId() {
    return crypto.randomUUID();
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

// Ejecutar un comando y obtener la salida
/*
async function executeCommand(command, args, dir) {
    try {
        const result = execSync(`${command} ${args.join(' ')}`, { 
            cwd: dir      // Directorio de trabajo
        });
        return result.toString();
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error(`Error: ${error.message}`);
    }
}*/

async function executeCommand(command, args, dir) {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args, { cwd: dir });
        let output = '';
        let errorOutput = '';

        process.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });
        
        
        /*
        process.stdout.on('data', (data) => {
            output += data.toString();
        });

        process.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });*/

        process.on('close', (code) => {
            if (code === 0) {
                resolve(output);
            } else {
                reject(new Error(`Error ejecutando ${command}: ${errorOutput}`));
            }
        });

        process.on('error', (err) => {
            reject(new Error(`Error al iniciar ${command}: ${err.message}`));
        });
    });
}

// Ejecutar GridLAB-DB desde un string GLM y obtener JSON
async function runGridlabdFromString(glmContent,id, outputFormat = 'json') {


    glmContent.objects = modifyFiles(glmContent.objects, `./`);

    const inputJsonFile = `temp_simulation_${generateUniqueId()}.json`;
    const outputJsonFile = `temp_output_${generateUniqueId()}.json`;

    const SaveinJsonFile = `uploads/${id}/${inputJsonFile}`;
    const SaveOutGlmFile = `uploads/${id}/${outputJsonFile}`;


    const workDir = `/home/david/Documents/react/API-SIMULADOR-BACK/uploads/${id}`;

    try {
        // Escribir el contenido GLM en un archivo temporal
        await fs.writeFile(SaveinJsonFile, glmContent);

        // Configurar los argumentos para GridLAB-DB
        const args = [
            inputJsonFile,
            '--output', outputJsonFile,
        ];

        // Ejecutar GridLAB-DB y esperar la salida
        const result = await executeCommand('gridlabd', args, workDir)
            .then(console.log)
            .catch(console.error);

        console.log(result);
        // Leer el archivo de salida JSON
        const jsonContent = await fs.readFile(SaveOutGlmFile, 'utf-8');

        // Eliminar archivos temporales
        await fs.unlink(SaveinJsonFile);
        await fs.unlink(SaveOutGlmFile);

        return jsonContent;
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error(`Error: ${error.essage}`);
    }
}

// Convertir GLM a JSON
async function glm2json(glmContent, id) {
    
    const jsontoken = generateUniqueId();
    const tempJsonFile = `temp_json_${jsontoken}.json`;
    const tempGlmFile = `temp_glm_${generateUniqueId()}.glm`;
    const tempJGFile = `temp_json_${jsontoken}.glm`;

    const SaveTempJsonFile = `uploads/${id}/${tempJsonFile}`;
    const SaveTempGlmFile = `uploads/${id}/${tempGlmFile}`;
    const SaveTempJGFile = `uploads/${id}/${tempJGFile}`;

    const workDir = `/home/david/Documents/react/API-SIMULADOR-BACK/uploads/${id}`;

    try {
        // Escribir el contenido GLM en un archivo temporal
        await fs.writeFile(SaveTempGlmFile, glmContent);

        // Configurar los argumentos para GridLAB-DB
        const args = [
            '-C', tempGlmFile,
            '-o', tempJsonFile,
            '--verbose'
        ];

        // Ejecutar GridLAB-DB y esperar la salida
        await executeCommand('gridlabd', args, workDir);

        // Leer el archivo JSON generado
        const jsonContent = await fs.readFile(SaveTempJsonFile, 'utf-8');

        // Eliminar archivos temporales
        await fs.unlink(SaveTempGlmFile);
        await fs.unlink(SaveTempJsonFile);

        return jsonContent;
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error(`Error: ${error.essage}`);
    }
}

// Convertir JSON a GLM
async function json2glm(jsonContent, id) {
    const jsontoken = generateUniqueId();
    const tempJsonFile = `temp_json_${jsontoken}.json`;
    const tempGlmFile = `temp_glm_${generateUniqueId()}.glm`;
    const tempJGFile = `temp_json_${jsontoken}.glm`;

    const SaveTempJsonFile = `uploads/${id}/${tempJsonFile}`;
    const SaveTempGlmFile = `uploads/${id}/${tempGlmFile}`;
    const SaveTempJGFile = `uploads/${id}/${tempJGFile}`;

    const workDir = `/home/david/Documents/react/API-SIMULADOR-BACK/uploads/${id}`;

    try {
        // Escribir el contenido JSON en un archivo temporal
        await fs.writeFile(SaveTempJsonFile, jsonContent);

        // Configurar los argumentos para GridLAB-DB
        const args = [
            '-C', tempJsonFile,
            '-o', tempGlmFile,
            '--verbose'
        ];

        // Ejecutar GridLAB-DB y esperar la salida
        await executeCommand('gridlabd', args, workDir);

        // Leer el archivo GLM generado
        const glmContent = await fs.readFile(SaveTempGlmFile, 'utf-8');

        // Eliminar archivos temporales
        await fs.unlink(SaveTempJsonFile);
        await fs.unlink(SaveTempGlmFile);
        await fs.unlink(SaveTempJGFile);

        return glmContent;
    } catch (error) {
        console.error('Error:', error.message);
        throw new Error(`Error: ${error.essage}`);
    }
}

module.exports = { runGridlabdFromString, glm2json, json2glm };
