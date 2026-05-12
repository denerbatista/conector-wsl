# Changelog

Todas as mudancas importantes ficam aqui. Segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [SemVer](https://semver.org/lang/pt-BR/).

## [0.3.0] - 2026-05-12

### Adicionado

- **Zero-config**: auto-deteccao de distro WSL (via `wsl --list --verbose`), usuario Linux (`$USER` / `whoami`), usuario Windows (`$USERPROFILE`). `user_config` agora sao todos opcionais.
- Arquitetura modular em `src/` (`config`, `detect`, `security`, `filesystem`, `wsl`, `sessions`, `tools/`).
- Logging estruturado JSON em stderr (`src/log.js`).
- Suite de testes com Vitest (`tests/`): security, filesystem, detect, config, sessions, wsl.
- Lint + format (ESLint 9 flat config + Prettier).
- CI no GitHub Actions: lint + test em Node 20/22, build do `.mcpb` em main/tags.
- Documentacao: README com badges + tabela de tools + diagrama de arquitetura, CONTRIBUTING, CHANGELOG, LICENSE.

### Mudou

- `manifest_version: "0.2"` -> `"0.3"`.
- Entry point `server/index.js` virou shim que importa `src/index.js`.
- `toHostPath` agora detecta paths `/mnt/<letra>/...` e converte pra `<Letra>:\...` (path Windows nativo) em vez de UNC, eliminando o `EPERM: operation not permitted` em `/mnt/c/Users/...`.

### Removido

- Pasta `entrega-colegas/` (legado de instalacao manual). Quem instalava via `instalar-mcp-manual.ps1` agora usa o `.mcpb` direto.

### Corrigido

- Permissao negada (`EPERM`) ao listar/ler `/mnt/c/...` no modo Windows (era loop UNC).

## [0.2.0] - 2026-03-17

Release inicial publico:

- 11 tools MCP (status, allowed_roots, list/get/read/write/create, run, start/run_in/close session).
- Plugin MCPB com `user_config` para distro, cwd, roots e timeout.
- Suporte a Windows (via UNC `\\wsl.localhost\<distro>`) e Linux nativo.
