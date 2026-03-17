# WSL Workspace Connector

Conector MCP local para usar terminal e filesystem do WSL dentro do Claude Desktop/Cowork.

## O que ele faz

- Executa comandos avulsos no WSL.
- Mantem sessoes persistentes com `cwd` e variaveis exportadas.
- Lista diretorios, le arquivos de texto e escreve arquivos dentro das roots permitidas.
- Restringe terminal e filesystem ao mesmo conjunto de caminhos configurados.

## Requisitos

- Windows com WSL funcionando.
- Node.js 20+.
- Claude Desktop/Cowork com suporte a MCP.
- `wsl_distro` configurada quando o bundle rodar no Windows e voce quiser usar as tools de filesystem.

## Ferramentas expostas

- `connector_status`
- `list_allowed_roots`
- `list_directory`
- `get_path_info`
- `read_text_file`
- `write_text_file`
- `create_directory`
- `run_wsl_command`
- `start_wsl_session`
- `run_in_wsl_session`
- `close_wsl_session`

## Instalar dependencias

Rode no WSL:

```bash
cd /home/denerbatista/projetos/my-projects/conector-wsl
npm install
```

## Rodar localmente

```bash
cd /home/denerbatista/projetos/my-projects/conector-wsl
node ./server/index.js
```

## Gerar o bundle para compartilhar

```bash
cd /home/denerbatista/projetos/my-projects/conector-wsl
npm run package
```

Isso gera o arquivo `conector-wsl.mcpb`, que pode ser aberto no Claude Desktop para instalar o conector pela UI.

## Instalar pela UI do Claude

Abra o arquivo `conector-wsl.mcpb` no Claude Desktop e preencha:

- `Diretorio inicial`: caminho Linux/WSL inicial. Exemplo: `/home/denerbatista`
- `Diretorios liberados`: caminhos Linux/WSL permitidos, separados por `:`
- `Distribuicao WSL`: nome da distro. Exemplo: `Ubuntu-24.04`

Depois disso, o conector aparece em `Conectores` como `WSL Workspace Connector`.

## Instalar manualmente para o Cowork

Este e o caminho recomendado para quem precisa usar o conector dentro do Cowork.

Em algumas builds do Claude, conectores locais instalados pela UI aparecem em `Conectores`, mas nao entram nas sessoes do Cowork. Para garantir que o Cowork enxergue o conector, adicione um MCP manual em `claude_desktop_config.json`.

Exemplo:

```json
{
  "mcpServers": {
    "wsl-workspace-direct": {
      "command": "C:\\Windows\\System32\\wsl.exe",
      "args": [
        "-d",
        "Ubuntu-24.04",
        "--",
        "node",
        "/home/denerbatista/projetos/my-projects/conector-wsl/server/index.js"
      ],
      "env": {
        "WSL_CONNECTOR_DEFAULT_CWD": "/home/denerbatista",
        "WSL_CONNECTOR_ALLOWED_ROOTS": "/home/denerbatista:/mnt/c/Users/DenerBatista",
        "WSL_CONNECTOR_DISTRO": "Ubuntu-24.04",
        "WSL_CONNECTOR_TIMEOUT_MS": "120000"
      }
    }
  }
}
```

Esse modo manual nao depende da UI de conectores e foi o caminho mais confiavel para o Cowork nas validacoes feitas neste projeto.

## Ordem recomendada de instalacao

Se o objetivo principal for Cowork:

1. Clone o repositorio dentro do WSL.
2. Rode `npm install`.
3. Registre o MCP manual `wsl-workspace-direct`.
4. Feche e abra o Claude.
5. Teste no Cowork.

Instalar o bundle pela UI fica como opcional, apenas para quem tambem quiser ver o conector em `Conectores`.

## Como replicar para colegas

1. Clone o repositorio dentro do WSL.
2. Rode `npm install`.
3. Rode `npm run package`.
4. Entregue o script de instalacao manual e o snippet de `claude_desktop_config.json`.
5. Deixe o `conector-wsl.mcpb` como opcional para quem quiser instalar pela UI.
6. Ajuste distro, usuario e roots de cada pessoa.

## Variaveis de ambiente

- `WSL_CONNECTOR_DEFAULT_CWD`: diretorio inicial.
- `WSL_CONNECTOR_ALLOWED_ROOTS`: lista de roots permitidas, separada por `:`.
- `WSL_CONNECTOR_DISTRO`: nome da distribuicao WSL.
- `WSL_CONNECTOR_TIMEOUT_MS`: timeout padrao por comando.
- `WSL_CONNECTOR_MAX_OUTPUT_CHARS`: limite da saida dos comandos.
- `WSL_CONNECTOR_MAX_FILE_CHARS`: limite da leitura de arquivos.

## Limites

- O conector nao cria TTY interativo real.
- Sessoes persistem apenas `cwd` e variaveis exportadas.
- Alias, funcoes shell e variaveis nao exportadas nao sao preservadas.
- As tools de filesystem trabalham apenas com texto UTF-8.
