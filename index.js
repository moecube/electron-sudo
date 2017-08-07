"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var child_process = require("child_process");
var crypto = require("crypto");
var electron_1 = require("electron");
var net = require("net");
var os = require("os");
var path = require("path");
var readline = require("readline");
// https://github.com/DefinitelyTyped/DefinitelyTyped/issues/17017
function fork(modulePath, args, options) {
    if (args === void 0) { args = []; }
    if (options === void 0) { options = {}; }
    if (!options.env) {
        options.env = {};
    }
    var ipcPath = path.join(os.tmpdir(), crypto.randomBytes(8).toString('hex'));
    if (process.platform === 'win32') {
        ipcPath = path.join('\\\\.\\pipe', ipcPath);
    }
    var elevate = new Buffer(JSON.stringify({
        method: 'fork',
        arguments: [modulePath, args, options],
        ipc: ipcPath
    })).toString('base64');
    var execPath = electron_1.remote.app.getPath('exe');
    var spawn_command, spawn_args;
    switch (process.platform) {
        case 'darwin':
            spawn_command = 'osascript';
            spawn_args = ['-e', "do shell script \"'" + execPath + "' . -e " + elevate + "\" with administrator privileges"];
            break;
        case 'win32':
            spawn_command = path.join(process.env['SystemRoot'], 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
            spawn_args = ['-Command',
                "Start-Process -FilePath \"" + execPath + "\" -ArgumentList .,-e," + elevate + " -Verb runAs -Wait -WindowStyle Hidden"];
            break;
        default:
            throw new Error('unsupported platform');
    }
    options.stdio = 'ignore';
    var child = child_process.spawn(spawn_command, spawn_args, options);
    var connection = [];
    child.send = function (message, sendHandle, _options, callback) {
        if (Array.isArray(connection)) {
            connection.push(arguments);
        }
        else {
            connection.write(JSON.stringify(message) + os.EOL, callback);
        }
        return true;
    };
    var server = net.createServer();
    server.listen(ipcPath);
    server.once('connection', function (conn) {
        for (var _i = 0, _a = connection; _i < _a.length; _i++) {
            var message = _a[_i];
            child.send.apply(child, message);
        }
        connection = conn;
        readline.createInterface({ input: connection }).on('line', function (line) {
            child.emit('message', JSON.parse(line));
        });
        // only accept one connection.
        server.close();
    });
    return child;
}
exports.fork = fork;
