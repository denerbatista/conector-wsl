# Guia Unico Para Colegas

Este guia existe para um unico objetivo: instalar e usar o `WSL Workspace Connector` com o script que ja acompanha este projeto.

O que o conector e e o que ele faz estao documentados no README principal do projeto.

Este arquivo cobre somente:

- instalacao com o script `instalar-mcp-manual.ps1`
- validacao no Claude/Cowork
- publicacao na organizacao

## O que o script faz automaticamente

O arquivo `instalar-mcp-manual.ps1` faz a instalacao pratica para o colega.

Ele:

- detecta o arquivo correto `claude_desktop_config.json`
- cria backup da configuracao atual do Claude
- registra o servidor MCP `wsl-workspace-direct`
- aponta o Claude para o `server/index.js` dentro do projeto no WSL
- grava `Default CWD`, `Allowed Roots`, `Distro` e `Timeout`

Ou seja: o colega nao precisa abrir JSON nem montar configuracao MCP na mao.

## Pre-requisitos

- Windows com WSL funcionando
- Claude Desktop instalado no Windows
- Node.js funcionando dentro da distro WSL
- este projeto copiado ou clonado dentro do WSL

Para confirmar o nome da distro:

```powershell
wsl -l -v
```

Para confirmar o Node dentro do WSL:

```powershell
wsl -d SUA_DISTRO -- node --version
```

## Como instalar com o script

1. Copie ou clone este projeto para dentro do WSL.
2. Rode `npm install` dentro da pasta do projeto no WSL.
3. No Windows, abra PowerShell na pasta `entrega-colegas`.
4. Execute o script `instalar-mcp-manual.ps1`.
5. Feche e abra o Claude Desktop.
6. Teste o conector no Cowork.

## Exemplo pronto

Se o projeto estiver em `/home/joao/projetos/conector-wsl` e a distro for `Ubuntu-24.04`, rode:

```powershell
.\instalar-mcp-manual.ps1 `
  -DistroName 'Ubuntu-24.04' `
  -LinuxProjectPath '/home/joao/projetos/conector-wsl' `
  -DefaultCwd '/home/joao' `
  -AllowedRoots '/home/joao:/mnt/c/Users/Joao'
```

Troque:

- `Ubuntu-24.04` pelo nome real da distro
- `/home/joao/projetos/conector-wsl` pelo caminho real do projeto no WSL
- `/home/joao` pelo diretorio inicial desejado
- `/mnt/c/Users/Joao` pelo caminho Windows que tambem pode ser acessado

## O que acontece depois da execucao

Se tudo der certo, o script mostra:

- o arquivo de configuracao alterado
- o caminho do backup criado
- o nome do servidor MCP registrado
- a distro usada
- o projeto WSL usado
- o `Default CWD`
- os `Allowed Roots`

Depois disso, basta reiniciar o Claude Desktop.

## Como testar no Claude

Abra uma tarefa no Cowork e use um teste simples, por exemplo:

```text
Use o conector WSL e rode `pwd` no meu ambiente.
```

Se o Claude responder com um caminho do WSL, a instalacao esta funcionando.

Voce tambem pode usar o arquivo `teste-no-claude.txt` desta pasta.

## Arquivos desta pasta

- `instalar-mcp-manual.ps1`: script principal de instalacao
- `claude_desktop_config.snippet.json`: referencia do MCP que o script grava automaticamente
- `teste-no-claude.txt`: prompt simples para validar no Claude

## Publicacao na organizacao

Se a organizacao quiser disponibilizar o conector para o time inteiro pelo Claude Desktop, use o arquivo `conector-wsl.mcpb`.

Importante:

- o script continua sendo o caminho de instalacao para colegas
- a publicacao organizacional e uma etapa separada, feita por administrador
- isso nao substitui nem quebra o que ja estiver funcionando localmente

Quem faz:

- `Owner` ou `Primary Owner` da organizacao no Claude Desktop

Como publicar:

1. Abrir o Claude Desktop com uma conta administradora.
2. Ir em `Organization settings > Connectors > Desktop`.
3. Ativar a `allowlist` se a organizacao quiser controlar extensoes liberadas.
4. Clicar em `Add custom extension`.
5. Selecionar o arquivo `conector-wsl.mcpb`.
6. Finalizar o upload.
7. Em `Custom team extensions`, abrir `...` e clicar em `Add to team`.

## Regra de uso deste guia

Para colegas:

- siga este README
- use o script
- nao edite JSON manualmente

Para administradores da organizacao:

- publiquem o `.mcpb` no painel organizacional
- usem a publicacao organizacional como distribuicao central
- mantenham o script como caminho de suporte para instalacao local quando necessario
