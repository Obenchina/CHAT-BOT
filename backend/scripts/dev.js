const { execFileSync, spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const projectRootKey = normalize(projectRoot);
const port = Number(process.env.PORT || 5000);

function normalize(value) {
    return String(value || '').replace(/\\/g, '/').toLowerCase();
}

function parseJsonOutput(output) {
    const text = String(output || '').trim();
    if (!text) return [];

    try {
        const data = JSON.parse(text);
        return Array.isArray(data) ? data : [data];
    } catch {
        return [];
    }
}

function runPowerShell(command) {
    try {
        return execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
    } catch {
        return '';
    }
}

function getWindowsNodeProcesses() {
    const output = runPowerShell(
        "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | " +
        'Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress'
    );

    return parseJsonOutput(output).map((processInfo) => ({
        pid: Number(processInfo.ProcessId),
        parentPid: Number(processInfo.ParentProcessId),
        commandLine: processInfo.CommandLine || ''
    })).filter((processInfo) => Number.isFinite(processInfo.pid));
}

function getWindowsPortOwners() {
    const output = runPowerShell(
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ` +
        'Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ConvertTo-Json -Compress'
    );

    return parseJsonOutput(output)
        .map(Number)
        .filter((pid) => Number.isFinite(pid) && pid > 0);
}

function commandLooksLikeThisBackend(commandLine) {
    const command = normalize(commandLine);
    return command.includes(projectRootKey) && command.includes('nodemon') && command.includes('src/app.js');
}

function hasThisBackendAncestor(pid, processMap) {
    let currentPid = pid;

    for (let depth = 0; depth < 8; depth += 1) {
        const processInfo = processMap.get(currentPid);
        if (!processInfo) return false;
        if (commandLooksLikeThisBackend(processInfo.commandLine)) return true;
        currentPid = processInfo.parentPid;
    }

    return false;
}

function killWindowsProcessTree(pid) {
    try {
        execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
            stdio: ['ignore', 'pipe', 'ignore']
        });
        return true;
    } catch {
        return false;
    }
}

function stopPreviousWindowsBackend() {
    const nodeProcesses = getWindowsNodeProcesses();
    const processMap = new Map(nodeProcesses.map((processInfo) => [processInfo.pid, processInfo]));
    const portOwners = getWindowsPortOwners();
    const targets = new Set();
    const unknownOwners = [];

    for (const processInfo of nodeProcesses) {
        if (processInfo.pid !== process.pid && commandLooksLikeThisBackend(processInfo.commandLine)) {
            targets.add(processInfo.pid);
        }
    }

    for (const pid of portOwners) {
        if (pid === process.pid) continue;

        const processInfo = processMap.get(pid);
        const command = normalize(processInfo?.commandLine);
        const isDirectBackend = command.includes('src/app.js');

        if (isDirectBackend || hasThisBackendAncestor(pid, processMap)) {
            targets.add(pid);
        } else {
            unknownOwners.push(pid);
        }
    }

    for (const pid of targets) {
        if (killWindowsProcessTree(pid)) {
            console.log(`Stopped previous backend process tree: ${pid}`);
        }
    }

    if (unknownOwners.length > 0) {
        console.warn(
            `Port ${port} is used by process ${unknownOwners.join(', ')}. ` +
            'It does not look like this backend, so it was not stopped automatically.'
        );
    }
}

function startNodemon() {
    const nodemonBin = path.join(projectRoot, 'node_modules', 'nodemon', 'bin', 'nodemon.js');
    const child = spawn(process.execPath, [nodemonBin, 'src/app.js'], {
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env
    });

    child.on('exit', (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
            return;
        }

        process.exit(code ?? 0);
    });
}

if (process.platform === 'win32') {
    stopPreviousWindowsBackend();
}

startNodemon();
