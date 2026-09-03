# WSL + Windows Workspace Connector

[![CI](https://github.com/denerbatista/conector-wsl/actions/workflows/ci.yml/badge.svg)](https://github.com/denerbatista/conector-wsl/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/claude-wsl-terminal-connector.svg)](https://www.npmjs.com/package/claude-wsl-terminal-connector)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-43853d.svg)](package.json)
[![MCPB](https://img.shields.io/badge/MCPB-0.3-0099ff.svg)](manifest.json)

Conector MCP local para Claude Desktop / Cowork que da ao Claude **acesso controlado a sua maquina**: terminal WSL, PowerShell do Windows, sessoes persistentes, abrir arquivos/URLs no Windows e filesystem dentro das pastas que voce libera. Quando o cliente e o **Claude Code** (que ja tem terminal), entra em **modo silencioso** e nao gasta contexto — pode vir embutido num plugin.

## Por que esse conector

- **Zero-config.** Instala e ja funciona — distro, usuario Linux e usuario Windows sao detectados automaticamente.
- **Sandbox por path.** Toda operacao de arquivo e terminal e validada contra uma lista de `allowed_roots` (`/home/<voce>` e `/mnt/c/Users/<voce>` por padrao).
- **Sessao com cwd preservado.** `cd` e variaveis exportadas continuam valendo entre comandos da mesma sessao.
- **Cross-host file access.** Acessa arquivos do WSL e do Windows sem o erro UNC-loop.
- **Dois lados, uma sandbox.** Comandos WSL (bash) e Windows (PowerShell) com a mesma lista de `allowed_roots`; caminhos podem ser `C:\...`, `\\wsl.localhost\...`, `/mnt/c/...` ou `/home/...`.
- **Modo silencioso.** Detecta o Claude Code pelo handshake MCP e registra so o status — plugins podem declara-lo sem custo no CLI.

## Instalacao

### Opcao 1 — Via npm (mais facil)

```bash
npm install -g claude-wsl-terminal-connector
```

O instalador detecta seu SO e ja adiciona o conector ao `claude_desktop_config.json` automaticamente. Basta **reiniciar o Claude Desktop**.

Funciona em WSL, Windows nativo, macOS e Linux.

### Opcao 2 — Claude Desktop / Cowork via .mcpb

1. Baixe `conector-wsl.mcpb` do [release mais recente](https://github.com/denerbatista/conector-wsl/releases/latest).
2. Arraste para o Claude Desktop, ou abra **Settings → Extensions → Install from file**.
3. Reinicie o Claude Desktop.

### Configuracao opcional

Todos os campos sao opcionais — o conector detecta tudo automaticamente. Se quiser sobrescrever:

| Campo           | Padrao auto-detectado                        | Quando preencher                    |
| --------------- | -------------------------------------------- | ----------------------------------- |
| `default_cwd`   | `/home/<linux-user>`                         | Quer comecar em outra pasta         |
| `allowed_roots` | `/home/<linux-user>:/mnt/c/Users/<win-user>` | Quer abrir mais ou menos diretorios |
| `wsl_distro`    | Distro com `*` em `wsl --list --verbose`     | Tem multiplas distros e quer fixar  |
| `timeout_ms`    | `120000`                                     | Comandos longos / curtos            |
| `mode`          | `auto`                                       | Forcar `full` ou `silent`           |

## Ferramentas expostas

| Tool                     | O que faz                                                              | Hint        |
| ------------------------ | ---------------------------------------------------------------------- | ----------- |
| `connector_status`       | Mostra config ativa, distro detectada, roots e flags de auto-deteccao. | readOnly    |
| `list_allowed_roots`     | Lista os roots autorizados.                                            | readOnly    |
| `list_directory`         | Lista arquivos e pastas de um diretorio permitido.                     | readOnly    |
| `get_path_info`          | Tipo, tamanho, datas de um caminho.                                    | readOnly    |
| `read_text_file`         | Le arquivo de texto (UTF-8) com limite de tamanho.                     | readOnly    |
| `write_text_file`        | Cria/sobrescreve arquivo de texto (UTF-8).                             | destructive |
| `create_directory`       | Cria diretorio (recursivo por padrao).                                 | write       |
| `run_wsl_command`        | Executa um comando avulso em shell nova.                               | destructive |
| `start_wsl_session`      | Abre sessao persistente (cwd e variaveis exportadas mantidos).         | write       |
| `run_in_wsl_session`     | Executa comando dentro de sessao persistente.                          | destructive |
| `close_wsl_session`      | Encerra sessao.                                                        | write       |
| `run_windows_command`    | Executa PowerShell no Windows em shell nova (`cwd` Windows ou Linux).  | destructive |
| `start_windows_session`  | Abre sessao PowerShell persistente (preserva cwd).                     | write       |
| `run_in_windows_session` | Executa comando dentro da sessao PowerShell.                           | destructive |
| `close_windows_session`  | Encerra a sessao PowerShell.                                           | write       |
| `open_in_windows`        | Abre arquivo, pasta ou URL no Windows (app padrao ou `app` informado). | write       |

As tools `*_windows_*` e `open_in_windows` aparecem quando o PowerShell e encontrado: Windows nativo ou WSL com interop (`/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`). Override: `WSL_CONNECTOR_POWERSHELL`.

## Modos: full x silent

| Cliente MCP (`clientInfo.name`)  | Modo   | Tools                                        |
| -------------------------------- | ------ | -------------------------------------------- |
| Claude Desktop / Cowork / outros | full   | todas                                        |
| `claude-code`                    | silent | so `connector_status` e `list_allowed_roots` |

O Claude Code roda dentro do WSL e ja tem Bash — as tools seriam redundantes e custariam contexto em toda sessao. Force um modo com `WSL_CONNECTOR_MODE=full|silent` (env, ou campo "Modo" na config do `.mcpb`).

### Uso em plugin do Claude Code / Cowork

Declare no `.mcp.json` do plugin e o conector sobe junto com ele (exige Node >= 20 na maquina):

```json
{
  "mcpServers": {
    "wsl-workspace": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "claude-wsl-terminal-connector@latest"]
    }
  }
}
```

No Cowork (Windows) ele entra em modo full; no Claude Code (WSL) em modo silent.

## Como funciona

```
Claude Desktop  --stdio-->  node src/index.js
                                 |
                                 +-- detect.js   (distro, linux user, win user)
                                 +-- config.js   (resolveConfig: env > deteccao)
                                 +-- wsl.js      (spawn wsl.exe -d <distro> -- bash -lc ...)
                                 +-- filesystem  (read/write/list via toHostPath)
                                 +-- sessions    (markers pra capturar cwd + state)
```

O modulo `filesystem.toHostPath` converte paths `/mnt/<letra>/...` para `<Letra>:\...` (path Windows nativo, sem UNC), resolvendo o `EPERM` classico em `/mnt/c/`.

## Desenvolvimento

```bash
git clone https://github.com/denerbatista/conector-wsl
cd conector-wsl
npm install

npm test           # vitest
npm run lint       # eslint
npm run format     # prettier --write
npm run package    # gera conector-wsl-X.Y.Z.mcpb
```

Requisitos: Node 20+.

## Limites conhecidos

- Nao cria TTY interativo real.
- Sessoes WSL preservam `cwd` e variaveis **exportadas**. Aliases, funcoes shell e variaveis nao exportadas nao persistem.
- Sessoes Windows (PowerShell) preservam apenas o `cwd`.
- Arquivos sao tratados como texto UTF-8. Para binarios, use `run_wsl_command` com `cat`, `cp`, `mv`.
- `open_in_windows` e as tools PowerShell exigem Windows ou WSL com interop; em Linux puro nao aparecem.

## Privacy Policy

Este conector roda **inteiramente na sua maquina local**. Nao coleta, transmite nem armazena dados pessoais em servidores externos.

- **Coleta de dados**: Nenhuma. Sem telemetria, analytics ou dados de uso enviados a qualquer destino.
- **Acesso a dados**: O conector le e escreve arquivos apenas dentro dos diretorios `allowed_roots` que voce configura (padrao: home do WSL e pasta de usuario do Windows).
- **Compartilhamento com terceiros**: Nenhum. Todas as operacoes ficam na sua maquina.
- **Retencao de dados**: Nenhum dado e persistido alem da sessao atual do Claude Desktop. O estado de sessao fica apenas em memoria.
- **Acesso a rede**: Nenhum. O conector se comunica exclusivamente via stdio local com o Claude Desktop — nenhuma requisicao de rede e feita.
- **Contato**: Para duvidas ou preocupacoes, abra uma issue em [github.com/denerbatista/conector-wsl](https://github.com/denerbatista/conector-wsl/issues).

## Licenca

[MIT](LICENSE) © Dener Batista
