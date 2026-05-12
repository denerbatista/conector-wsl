# Contribuindo

Obrigado pelo interesse em melhorar o conector. Este guia e curto pra voce comecar rapido.

## Setup local

```bash
git clone https://github.com/denerbatista/conector-wsl
cd conector-wsl
npm install
```

Requisitos: Node 20+.

## Comandos uteis

```bash
npm test               # roda Vitest
npm run test:watch     # watch mode
npm run lint           # ESLint
npm run format         # Prettier --write
npm run format:check   # Prettier --check (usado no CI)
npm run package        # gera conector-wsl-X.Y.Z.mcpb
```

## Estrutura

```
src/
├── index.js          # entry MCP (boot + connect)
├── config.js         # resolveConfig (env + auto-deteccao)
├── detect.js         # detectDistro / detectLinuxUser / detectWindowsUser
├── security.js       # validacao de paths + parseAllowedRoots
├── filesystem.js     # toHostPath, helpers de stat/sort/truncate
├── wsl.js            # spawn de bash (wsl.exe ou /bin/bash)
├── sessions.js       # sessoes persistentes com markers
├── log.js            # logger JSON em stderr
├── util.js           # textResult MCP
└── tools/            # registracao das tools no McpServer
    ├── index.js
    ├── status.js
    ├── filesystem.js
    ├── terminal.js
    └── sessions.js
tests/                # vitest (1 arquivo por modulo)
```

## Padroes de codigo

- ES modules (`"type": "module"`).
- Sem TypeScript hoje (talvez 0.4); valide schemas com `zod`.
- Logs **so em stderr** (stdout e o canal MCP).
- Toda operacao de path passa por `isPathAllowed`/`resolveLinuxPath` antes de tocar o host.
- Sem dependencias novas sem discussao (peso do bundle MCPB importa).

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/pt-br/):

- `feat:` nova funcionalidade
- `fix:` bug
- `refactor:` mudanca interna sem alteracao de comportamento
- `test:` testes
- `docs:` documentacao
- `chore:` infra, deps, CI

## Pull Request

1. Crie branch a partir de `main`: `feat/minha-feature` ou `fix/issue-xx`.
2. `npm run lint && npm test` precisam passar.
3. Atualize `CHANGELOG.md` na secao `[Unreleased]`.
4. Abra o PR pra `main` com descricao do que mudou e por que.

## Bug report

Inclua:

- Versao do conector (`connector_status`).
- Distro WSL (`wsl --list --verbose`).
- Versao Node (`node -v`).
- Output completo do erro (stderr do MCP em `~/AppData/Roaming/Claude/logs/mcp-server-*.log`).
- Passos pra reproduzir.
