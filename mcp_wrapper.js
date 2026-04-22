
const { spawn } = require('child_process');
const path = require('path');

// Path to the actual MCP server entry point
const mcpScript = path.join(__dirname, 'node_modules', 'chrome-devtools-mcp', 'build', 'src', 'index.js');

// Spawn the MCP process
const child = spawn(process.execPath, [mcpScript, ...process.argv.slice(2)], {
    stdio: ['inherit', 'pipe', 'inherit'] // Pipe stdout, inherit stdin/stderr
});

child.stdout.on('data', (data) => {
    const str = data.toString();
    // Filter out known non-JSON lines that pollute stdout
    if (str.includes('chrome-devtools-mcp exposes content') ||
        str.includes('Avoid sharing sensitive') ||
        str.includes('TCP') ||
        str.match(/^\s*$/)) {
        // Send these to stderr instead so they can be seen but don't break JSON-RPC
        process.stderr.write(str);
        return;
    }
    // Pass through everything else (JSON-RPC)
    process.stdout.write(data);
});

child.on('close', (code) => {
    process.exit(code);
});
