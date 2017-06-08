import * as child_process from 'child_process';
import { ChildProcess, ForkOptions } from 'child_process';
import { remote } from 'electron';
import * as net from 'net';
import { Socket } from 'net';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

export function fork(modulePath: string, args: string[] = [], options: ForkOptions = {}): ChildProcess {
    if (!options.env) {
        options.env = {};
    }

    let ipcPath;
    if (process.platform === 'win32') {
        ipcPath = path.join('\\\\.\\pipe', os.tmpdir(), Math.random().toString());
    } else {
        ipcPath = path.join(os.tmpdir(), Math.random().toString());
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
            spawn_args = ['-Command',
                `Start-Process -FilePath "${execPath}" -ArgumentList .,-e,${elevate} -Verb runAs -Wait -WindowStyle Hidden`];
            break;
        default:
            throw 'unsupported platform';
    }
    // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/17017
    options.stdio = <any>'ignore';

    let child = child_process.spawn(spawn_command, spawn_args, options);

    let connection: Socket | IArguments[] = [];
    // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/17018
    child.send = <any>((message: any, sendHandle?: any, _options?: any, callback?: any) => {
        if (Array.isArray(connection)) {
            connection.push(arguments);
        } else {
            connection!.write(JSON.stringify(message) + os.EOL, callback);
        }
    });


    let server = net.createServer();
    server.listen(ipcPath);
    server.once('connection', (conn) => {
        for (let message of <IArguments[]>connection) {
            child.send.apply(child, message);
        }
        connection = conn;
        // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/17020
        readline.createInterface({ input: <any>connection }).on('line', (line) => {
            child.emit('message', JSON.parse(line));
        });

        // only accept one connection.
        server.close();
    });
    return child;

};
