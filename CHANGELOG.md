# Changelog

Todas as mudancas importantes ficam aqui. Segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [SemVer](https://semver.org/lang/pt-BR/).

## [0.5.0] - 2026-09-03

### Adicionado

- **Lado Windows (PowerShell)** — o conector agora e "WSL + Windows Workspace Connector". Tools novas:
  `run_windows_command` (PowerShell em shell nova), `start_windows_session` / `run_in_windows_session` /
  `close_windows_session` (sessao persistente com cwd preservado) e `open_in_windows` (abre arquivo, pasta
  ou URL com o app padrao, ou com um `app` informado — ex.: `phpstorm64.exe`). Registradas quando o
  PowerShell esta acessivel: Windows nativo (`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`)
  ou WSL com interop (`/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`). Override:
  `WSL_CONNECTOR_POWERSHELL`.
- **Mesma sandbox nos dois lados**: `cwd`/alvos aceitam caminho Windows (`C:\...`, `\\wsl.localhost\...`) ou
  Linux (`/mnt/c/...`, `/home/...`) e sao validados contra `allowed_roots` pela forma Linux equivalente
  (`toLinuxPath` / `toWindowsPath`). Sessao Windows que sai do escopo e bloqueada, como no WSL.
- **Modo silencioso para o Claude Code**. No handshake MCP o conector le `clientInfo.name`: se for
  `claude-code` (que roda dentro do WSL e ja tem Bash), registra so `connector_status` e
  `list_allowed_roots` — zero custo de contexto. Qualquer outro cliente (Claude Desktop/Cowork) recebe
  tudo. Forca com `WSL_CONNECTOR_MODE=full|silent` (env ou `user_config.mode` no `.mcpb`). Isso permite
  declarar o conector no `.mcp.json` de um plugin do Claude Code sem penalizar o CLI.
- `connector_status` passou a informar `mode`, `client`, `windowsTools` e `powershell`.
- Saida do PowerShell forcada em UTF-8; comando enviado via `-EncodedCommand` (sem problemas de escape);
  `\r` removido do stdout/stderr.

### Mudou

- Registro de tools em duas etapas: core antes do `connect`, resto no `initialized` (SDK
  `oninitialized` + `getClientVersion`). `registerAllTools` continua exportado para compatibilidade.
- Versao do servidor MCP passa a vir do `package.json` (antes estava fixa em `0.3.0` no `index.js`).
- Testes: +35 (windows, mode, smoke em modo full/silent/override). Total 78.

### Limites

- Sessao Windows preserva **cwd**; variaveis, funcoes e aliases nao persistem entre comandos.
- Sem PowerShell acessivel as tools Windows simplesmente nao aparecem (log `windows.tools.skipped`).

## [0.4.0] - 2026-05-14

### Corrigido

- **Caminho absoluto do binario no `command`** registrado no `claude_desktop_config.json`. Antes, o postinstall gravava apenas `"claude-wsl-terminal-connector"`; como o Claude Desktop **nao herda o `PATH` do shell**, em muitos casos o conector simplesmente nao subia (falha silenciosa). Agora resolvemos via `npm prefix -g` + fallback `which` e gravamos o caminho completo.
- **WSL -> Claude Desktop (Windows)**: quando o `npm install -g` rodava dentro do WSL mas o Claude Desktop estava no Windows, o `command` registrado nao era executavel pelo Windows. Agora gravamos `wsl.exe -d <distro> -- /caminho/absoluto/no/wsl/bin`, que e o jeito correto de invocar um binario WSL a partir do Windows.
- **Windows nativo**: aponta agora pro `.cmd` shim absoluto que o npm cria em `%APPDATA%\npm\claude-wsl-terminal-connector.cmd`.

### Adicionado

- **Atualizacao automatica em vez de skip**: se a entrada `wsl-connector` ja existir no config mas com `command`/`args` diferentes (ex.: instalou v0.3.x e agora atualizou pra v0.4.0), o postinstall **atualiza** a entrada em vez de pular. Idempotencia de verdade: roda 2x identico = no-op; roda apos mudanca = update.
- **Backup automatico** do `claude_desktop_config.json` antes de qualquer modificacao, em `claude_desktop_config.json.bak-<ISO timestamp>`.
- **`scripts/preuninstall.js`**: ao rodar `npm uninstall -g claude-wsl-terminal-connector`, a entrada `wsl-connector` e removida do config preservando todas as outras entradas de `mcpServers` e demais chaves. Faz backup tambem.
- **Variaveis de ambiente de controle**:
  - `CLAUDE_WSL_SKIP_REGISTER=1` — pula o auto-registro/limpeza (util pra CI, ambientes corporativos, ou quem prefere editar config a mao).
  - `CLAUDE_WSL_CONFIG_PATH=/caminho/customizado.json` — forca um caminho de config especifico (util pra testes e setups customizados).
- Deteccao de `WSL_DISTRO_NAME` para registrar a flag `-d <distro>` correta na entrada.

### Mudou

- `detectWindowsUser()` agora usa `cmd.exe /c echo %USERPROFILE%` (mais rapido e estavel) em vez de `wsl.exe -e bash -c`.
- O instalador **nao falha mais o `npm install`** em caso de erro de auto-configuracao: agora apenas avisa e devolve as instrucoes manuais via `console.warn`.

## [0.3.2] - 2026-05-12

### Adicionado

- **Auto-configuracao do Claude Desktop** via `scripts/postinstall.js`. Ao rodar `npm install -g claude-wsl-terminal-connector`, o conector detecta o SO e ja se adiciona ao `claude_desktop_config.json` — basta reiniciar o Claude Desktop.
  - WSL: detecta usuario Windows via `$USERPROFILE` e escreve no caminho correto do Windows (`/mnt/c/Users/<usuario>/AppData/Roaming/Claude/`)
  - Windows nativo: escreve em `%APPDATA%\Claude\`
  - macOS: escreve em `~/Library/Application Support/Claude/`
  - Linux nativo: escreve em `~/.config/Claude/`
- Idempotente: nao sobrescreve configuracao existente para o conector.
- Falha silenciosa com instrucao manual em caso de erro.

## [0.3.1] - 2026-05-12

### Adicionado

- **Publicado no npm** como [`claude-wsl-terminal-connector`](https://www.npmjs.com/package/claude-wsl-terminal-connector). Instalacao via `npx claude-wsl-terminal-connector` sem precisar baixar o `.mcpb` manualmente.
- Badge npm no README linkando para o pacote.
- Secao de instalacao alternativa via `npx` / `npm install -g` para qualquer cliente MCP compativel.
- Tool annotations (`readOnlyHint` / `destructiveHint`) em todas as 11 tools — requisito do Connectors Directory da Anthropic.
- Secao Privacy Policy no README e campo `privacy_policies` no `manifest.json`.
- Coluna Hint na tabela de ferramentas expostas no README.
- Submissao ao Connectors Directory oficial da Anthropic (em revisao).

### Corrigido

- `parseWslListVerbose` extraido como funcao testavel em `detect.js` (fix de deteccao em alguns ambientes Windows).
- Deteccao de `isMainModule` normaliza separadores de path (`/` vs `\`) para funcionar tanto em Windows nativo quanto WSL.

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
