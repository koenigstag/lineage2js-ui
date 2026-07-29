 # Contributing Guide

Thank you for contributing! This guide describes the basic workflow and requirements for contributing to the project.

## Development Setup

### Requirements:

- Node.js >= 22
- pnpm >= 9.15.0
- common sense of git and GitHub usage

### Installing Node.js (if you don't have it installed):

#### Installation options
- native installation (boring but simple):
  - open [nodejs.org](https://nodejs.org/en/download/)
  - download *.msi installer for version specified in the [.nvmrc](.nvmrc) or higher
- using nvm manager (recommended):
  - linux/macOS: [nvm-sh/nvm](https://github.com/nvm-sh/nvm)
    - install nodejs using command `nvm install $(cat .nvmrc)` inside your linux terminal
    - run command `cat .nvmrc | nvm use` to switch to the fresh nodejs version
  - using nvm-windows: [nvm-windows](https://github.com/coreybutler/nvm-windows)
    - install nodejs using command `nvm install $(Get-Content .nvmrc)` inside your PowerShell terminal
    - run command `nvm use $(Get-Content .nvmrc)` to switch to the fresh nodejs version

### Enable pnpm using Corepack:

Corepack is included with Node.js >= 16.9.0 and is used to auto-install package managers like pnpm.

```bash
corepack enable
```

### Install dependencies:

To run the project you need to install dependencies using pnpm:

```bash
pnpm install
```

### Create environment file:

To config the project you need to create a `.env` file in the `packages/ui` folder. You can use the example file provided and modify it as needed:

```bash
cp packages/ui/.env.example packages/ui/.env
```

### Run the project:

This command will start the dev server for the UI package and watch for changes in the network package:

```bash
pnpm dev:ui
```

### Open the project in your browser:

Open your browser and navigate to [http://localhost:5173](http://localhost:5173) to see the project running.

### To use the real login/game server

Set the `VITE_LOGIN_SERVER_IP` and `VITE_LOGIN_SERVER_PORT` variables inside the `.env` file to point to the real login/game server. The default values are empty.

###  To start your own game server

Please refer to the [lineage2ts](https://gitlab.com/MrTREX/lineage2ts/-/blob/master?ref_type=heads) repository for instructions how to run WS proxy for game/login servers.


## Contributing Workflow

1. Fork the repository and clone it to your local machine.
2. Create a new branch for your feature or bug fix
3. Make your changes and commit them with clear messages.
4. Push your changes to your forked repository.
5. Create a pull request to the main repository.

## Pull Requests

#### Before opening a PR:

- Run tests
- Run lint
- Check formatting
- Update documentation if needed

#### PR description should include:

- What changed
- Why it was changed
- How to test it
- Screenshots if applicable