const fs = require("fs");
const csv = require("csv");

function readFile(filepath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filepath, (err, contents) => {
            if(err) {
                return reject(err);
            }

            resolve(contents);
        });
    });
}

async function csvRead(filepath, options) {
    const contents = await readFile(filepath);

    return new Promise((resolve, reject) => {
        csv.parse(contents, {
            columns: true,
            auto_parse: true,
            ...options
        }, (err, data) => {
            if(err) {
                return reject(err);
            }

            resolve(data);
        });
    });
}

function csvWrite(filepath, data, options) {
    return new Promise((resolve, reject) => {
        csv.stringify(data, options, (err, output) => {
            if(err) {
                return reject(err);
            }

            fs.writeFile(filepath, output, (err) => {
                if(err) {
                    return reject(err);
                }

                resolve(output);
            })
        });
    });
}

module.exports = {
    csvRead, csvWrite, readFile
};