import * as child_process from 'child_process';
import * as crypto from 'crypto';
import { remote } from 'electron';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
// https://github.com/DefinitelyTyped/DefinitelyTyped/issues/17017
export function fork(modulePath, args = [], options = {}) {
    if (!options.env) {
        options.env = {};
    }
    let ipcPath = path.join(os.tmpdir(), crypto.randomBytes(8).toString('hex'));
    if (process.platform === 'win32') {
        ipcPath = path.join('\\\\.\\pipe', ipcPath);
    }
    const elevate = new Buffer(JSON.stringify({
        method: 'fork',
        arguments: [modulePath, args, options],
        ipc: ipcPath
    })).toString('base64');
    const execPath = remote.app.getPath('exe');
    let spawn_command, spawn_args;
    switch (process.platform) {
        case 'darwin':
            spawn_command = 'osascript';
            spawn_args = ['-e', `do shell script "'${execPath}' . -e ${elevate}" with administrator privileges`];
            break;
        case 'win32':
            spawn_command = path.join(process.env['SystemRoot'], 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
            spawn_args = ['-Command',
                `Start-Process -FilePath "${execPath}" -ArgumentList .,-e,${elevate} -Verb runAs -Wait -WindowStyle Hidden`];
            break;
        default:
            throw new Error('unsupported platform');
    }
    options.stdio = 'ignore';
    const child = child_process.spawn(spawn_command, spawn_args, options);
    let connection = [];
    child.send = function (message, sendHandle, _options, callback) {
        if (Array.isArray(connection)) {
            connection.push(arguments);
        }
        else {
            connection.write(JSON.stringify(message) + os.EOL, callback);
        }
        return true;
    };
    const server = net.createServer();
    server.listen(ipcPath);
    server.once('connection', (conn) => {
        for (const message of connection) {
            child.send.apply(child, message);
        }
        connection = conn;
        readline.createInterface({ input: connection }).on('line', (line) => {
            child.emit('message', JSON.parse(line));
        });
        // only accept one connection.
        server.close();
    });
    return child;
}
//# sourceMappingURL=index.js.map