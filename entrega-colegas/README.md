# Entrega Para Colegas

Esta pasta contem o pacote de entrega do `WSL Workspace Connector`.

## Pre-requisitos

- Windows com WSL funcionando.
- Node.js 20+ instalado dentro da distro WSL.
- Claude Desktop instalado no Windows.

## O que enviar

- `conector-wsl.mcpb`: bundle para instalar pela UI de Conectores do Claude. Opcional.
- `claude_desktop_config.snippet.json`: exemplo do MCP manual que realmente entra no Cowork.
- `instalar-mcp-manual.ps1`: script recomendado para registrar `wsl-workspace-direct`.
- `teste-no-claude.txt`: prompt de teste para colar no Claude depois da instalacao.

## Caminho recomendado

Para colegas que precisam usar o conector dentro do Cowork, o caminho recomendado e o MCP manual `wsl-workspace-direct`.

Fluxo:

1. Clonar ou copiar este projeto para dentro do WSL.
2. Confirmar `node --version` dentro do WSL.
3. Rodar `npm install` no diretorio do projeto.
4. No Windows, rodar `instalar-mcp-manual.ps1`.
5. Fechar e abrir o Claude.
6. Abrir uma tarefa nova no Cowork.
7. Colar o conteudo de `teste-no-claude.txt`.

## Exemplo de instalacao

Se o projeto foi clonado em `/home/alice/projetos/conector-wsl` e a distro e `Ubuntu-24.04`:

```powershell
.\instalar-mcp-manual.ps1 `
  -DistroName 'Ubuntu-24.04' `
  -LinuxProjectPath '/home/alice/projetos/conector-wsl' `
  -DefaultCwd '/home/alice' `
  -AllowedRoots '/home/alice:/mnt/c/Users/Alice'
```

O script detecta automaticamente o arquivo correto do Claude Desktop:

- instalacao MSIX/Windows Store: `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`
- instalacao classica: `%APPDATA%\Claude\claude_desktop_config.json`

## UI de Conectores

O bundle `conector-wsl.mcpb` pode ser instalado pela UI se voce quiser que o conector apareca em `Conectores`.

Mas isso deve ser tratado como opcional. Nas validacoes deste projeto, o bundle pela UI apareceu corretamente, porem o Cowork foi mais confiavel usando o MCP manual `wsl-workspace-direct`.

Se o objetivo for apenas fazer o Cowork funcionar, pode pular a instalacao pela UI.

## Evitar duplicidade

Nao e necessario instalar dois conectores com a mesma funcao para o Cowork.

Recomendacao:

- mantenha `wsl-workspace-direct` como conector funcional
- use o bundle da UI apenas se quiser a aparencia em `Conectores`
- se a UI causar confusao ou duplicidade, remova/desative o bundle e deixe so o MCP manual
