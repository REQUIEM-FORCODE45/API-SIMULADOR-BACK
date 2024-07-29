const output = require('./test/input.json');


const organizeObjects = (objects) => {
    const uniqueNames = [...new Set(objects.map(obj => obj.name))];
    
    // Crear un diccionario para clasificar los objetos
    const classifiedObjects = uniqueNames.reduce((acc, name) => {
        acc[name] = [];
        return acc;
    }, {});
    
    objects.forEach(obj => {
        const name = obj.name;
        classifiedObjects[name].push(obj);
    });
    
    const columns = uniqueNames.reduce((acc, name) => {
        console.log(classifiedObjects[name]);
        if (classifiedObjects[name].length > 0) {
            acc[name] = Object.keys(classifiedObjects[name][0].attributes).map(key => {
                return {
                    Header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
                    accessor: key
                };
            });
        }
        return acc;
    }, {});

   return {
    classifiedObjects,
    columns,
    uniqueNames,
   };
}

