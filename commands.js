// commands.js - Terminal commands kept separate from keyboard shortcut records
const TERMINAL_COMMANDS = [
    { platform: 'windows', shell: 'PowerShell', name: 'List files', command: 'Get-ChildItem', description: 'List files and folders in the current directory.', usage: 'Get-ChildItem -Force' },
    { platform: 'windows', shell: 'PowerShell', name: 'Show current directory', command: 'Get-Location', description: 'Print the current working directory.', usage: 'Get-Location' },
    { platform: 'windows', shell: 'PowerShell', name: 'Create a directory', command: 'New-Item -ItemType Directory', description: 'Create a new directory without removing existing data.', usage: 'New-Item -ItemType Directory projects' },
    { platform: 'windows', shell: 'PowerShell', name: 'Copy a file', command: 'Copy-Item', description: 'Copy a file or directory to another location.', usage: 'Copy-Item notes.txt backup.txt' },
    { platform: 'windows', shell: 'PowerShell', name: 'Find text in files', command: 'Select-String', description: 'Search file contents for a text pattern.', usage: 'Select-String -Path *.txt -Pattern "term"' },
    { platform: 'mac', shell: 'zsh/bash', name: 'List files', command: 'ls -la', description: 'List visible and hidden files with details.', usage: 'ls -la' },
    { platform: 'mac', shell: 'zsh/bash', name: 'Show current directory', command: 'pwd', description: 'Print the current working directory.', usage: 'pwd' },
    { platform: 'mac', shell: 'zsh/bash', name: 'Create a directory', command: 'mkdir', description: 'Create a new directory.', usage: 'mkdir projects' },
    { platform: 'mac', shell: 'zsh/bash', name: 'Copy a file', command: 'cp', description: 'Copy a file or directory to another location.', usage: 'cp notes.txt backup.txt' },
    { platform: 'mac', shell: 'zsh/bash', name: 'Find text in files', command: 'grep', description: 'Search file contents for a text pattern.', usage: 'grep -n "term" notes.txt' },
    { platform: 'linux', shell: 'Bash', name: 'List files', command: 'ls -la', description: 'List visible and hidden files with details.', usage: 'ls -la' },
    { platform: 'linux', shell: 'Bash', name: 'Show current directory', command: 'pwd', description: 'Print the current working directory.', usage: 'pwd' },
    { platform: 'linux', shell: 'Bash', name: 'Create a directory', command: 'mkdir', description: 'Create a new directory.', usage: 'mkdir projects' },
    { platform: 'linux', shell: 'Bash', name: 'Copy a file', command: 'cp', description: 'Copy a file or directory to another location.', usage: 'cp notes.txt backup.txt' },
    { platform: 'linux', shell: 'Bash', name: 'Find text in files', command: 'grep', description: 'Search file contents for a text pattern.', usage: 'grep -n "term" notes.txt' }
];

window.TERMINAL_COMMANDS = TERMINAL_COMMANDS;
