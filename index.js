const os = require('os');
const net = require('net');
const path = require('path');
const readline = require('readline');
const child_process = require("child_process");

const {remote} = require('electron');

module.exports.fork = function (modulePath, args = [], options = {}) {
    if (!options.env) {
        options.env = {}
    }

    let ipcPath;
    if (process.platform == 'win32') {
        ipcPath = path.join('\\\\.\\pipe', os.tmpdir(), Math.random().toString())
    } else {
        ipcPath = path.join(os.tmpdir(), Math.random().toString())
    }

    let elevate = new Buffer(JSON.stringify({
        method: 'fork',
        arguments: [modulePath, args, options],
        ipc: ipcPath
    })).toString('base64');
    let execPath = remote.app.getPath('exe');
    let spawn_command, spawn_args;
    switch (process.platform) {
        case 'darwin':
            spawn_command = 'osascript';
            spawn_args = ['-e', `do shell script "'${execPath}' . -e ${elevate}" with administrator privileges`];
            break;
        case 'win32':
            spawn_command = path.join(process.env['SystemRoot'], 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
            spawn_args = ['-Command', `Start-Process -FilePath "${execPath}" -ArgumentList .,-e,${elevate} -Verb runAs -Wait -WindowStyle Hidden`];
            break;
    }

    let child = child_process.spawn(spawn_command, spawn_args, options);

    let connection = [];
    child.send = (message, sendHandle, options, callback)=> {
        if (Array.isArray(connection)) {
            connection.push(arguments);
        } else {
            connection.write(JSON.stringify(message) + os.EOL, callback);
        }
    };

    let server = net.createServer();
    server.listen(ipcPath);
    server.once('connection', (conn)=> {
        for (let message of connection) {
            child.send.apply(child, message);
        }
        connection = conn;
        readline.createInterface({input: connection}).on('line', (line) => {
            child.emit('message', JSON.parse(line));
        });

        // only accept one connection.
        server.close();
    });
    return child

};