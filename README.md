# WSL Workspace Connector

[![CI](https://github.com/denerbatista/conector-wsl/actions/workflows/ci.yml/badge.svg)](https://github.com/denerbatista/conector-wsl/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-43853d.svg)](package.json)
[![MCPB](https://img.shields.io/badge/MCPB-0.3-0099ff.svg)](manifest.json)

Conector MCP local para Claude Desktop / Cowork que da ao Claude **acesso controlado ao seu WSL**: terminal, sessao persistente e filesystem dentro das pastas que voce libera.

## Por que esse conector

- **Zero-config.** Instala o `.mcpb` e ja funciona — distro, usuario Linux e usuario Windows sao detectados automaticamente.
- **Sandbox por path.** Toda operacao de arquivo e terminal e validada contra uma lista de `allowed_roots` (`/home/<voce>` e `/mnt/c/Users/<voce>` por padrao).
- **Sessao com cwd preservado.** `cd` e variaveis exportadas continuam valendo entre comandos da mesma sessao.
- **Cross-host file access.** Acessa arquivos do WSL (via `\\wsl.localhost\`) e do Windows (via `C:\...` mapeado de `/mnt/c/...`) sem o erro UNC-loop.

## Instalacao (Claude Desktop)

1. Baixe `conector-wsl.mcpb` do release mais recente.
2. Arraste o arquivo para o Claude Desktop, ou abra **Settings -> Extensions -> Install from file**.
3. Reinicie o Claude Desktop (System Tray -> Quit, abrir de novo).

Pronto. Nao precisa preencher nada na tela de configuracao — todos os campos sao opcionais e auto-detectaveis.

Se quiser sobrescrever:

| Campo           | Padrao auto-detectado                        | Quando preencher                    |
| --------------- | -------------------------------------------- | ----------------------------------- |
| `default_cwd`   | `/home/<linux-user>`                         | Quer comecar em outra pasta         |
| `allowed_roots` | `/home/<linux-user>:/mnt/c/Users/<win-user>` | Quer abrir mais ou menos diretorios |
| `wsl_distro`    | Distro com `*` em `wsl --list --verbose`     | Tem multiplas distros e quer fixar  |
| `timeout_ms`    | `120000`                                     | Comandos longos / curtos            |

## Ferramentas expostas

| Tool                 | O que faz                                                              |
| -------------------- | ---------------------------------------------------------------------- |
| `connector_status`   | Mostra config ativa, distro detectada, roots e flags de auto-deteccao. |
| `list_allowed_roots` | Lista os roots autorizados.                                            |
| `list_directory`     | Lista arquivos e pastas de um diretorio permitido.                     |
| `get_path_info`      | Tipo, tamanho, datas de um caminho.                                    |
| `read_text_file`     | Le arquivo de texto (UTF-8) com limite de tamanho.                     |
| `write_text_file`    | Cria/sobrescreve arquivo de texto (UTF-8).                             |
| `create_directory`   | Cria diretorio (recursivo por padrao).                                 |
| `run_wsl_command`    | Executa um comando avulso em shell nova.                               |
| `start_wsl_session`  | Abre sessao persistente (cwd e variaveis exportadas mantidos).         |
| `run_in_wsl_session` | Executa comando dentro de sessao persistente.                          |
| `close_wsl_session`  | Encerra sessao.                                                        |

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

O modulo `filesystem.toHostPath` faz a coisa esperta: paths `/mnt/<letra>/...` viram `<Letra>:\...` (path Windows nativo, sem UNC). Paths `/home/...`, `/etc/...` etc viram `\\wsl.localhost\<distro>\...`. Isso resolve o `EPERM` classico em `/mnt/c/`.

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
- Sessoes preservam `cwd` e variaveis **exportadas**. Aliases, funcoes shell e variaveis nao exportadas nao persistem.
- Arquivos sao tratados como texto UTF-8. Para binarios, use `run_wsl_command` com `cat`, `cp`, `mv`.

## Licenca

[MIT](LICENSE) © Dener Batista
