/// <reference types="node" />
import { ChildProcess, ForkOptions } from 'child_process';
export declare function fork(modulePath: string, args?: string[], options?: ForkOptions | any): ChildProcess;
