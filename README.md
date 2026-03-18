# WSL Workspace Connector

Conector MCP local para Claude Desktop/Cowork que permite ao Claude trabalhar no seu WSL de forma controlada.

## O que ele faz

Este conector entrega ao Claude quatro capacidades praticas dentro do WSL:

- executar comandos no terminal, como `pwd`, `ls`, `git status`, `npm test` e `python`
- manter uma sessao de trabalho, para que `cd` e variaveis exportadas continuem valendo entre uma acao e outra
- ler e escrever arquivos de texto dentro das pastas liberadas
- limitar o acesso do Claude somente aos caminhos que voce definir na instalacao

Em resumo: ele faz o Claude operar no seu ambiente Linux do WSL sem precisar editar JSON manualmente nem configurar MCP na mao em cada maquina.

## Como ele faz

O fluxo e simples:

1. O Claude Desktop instala o arquivo `conector-wsl.mcpb` como extensao local.
2. Durante a instalacao, o proprio Claude mostra um formulario com os dados que esse conector precisa.
3. Quando o Claude precisa agir, ele sobe o servidor MCP local do projeto.
4. Esse servidor chama o `wsl.exe`, entra na distribuicao WSL configurada e executa as operacoes solicitadas.
5. O resultado volta para o Claude ja dentro da conversa ou da tarefa no Cowork.

Isso deixa a instalacao padronizada e automatizada para todos os colegas: o mesmo bundle, a mesma tela de configuracao e o mesmo comportamento.

## Forma unica de instalacao para colegas

Este projeto adota um unico caminho de instalacao:

- distribuir o arquivo `conector-wsl.mcpb`
- instalar esse arquivo no Claude Desktop pela interface de extensoes

Nao use `claude_desktop_config.json`, nao use MCP manual e nao use configuracao por URL remota para este projeto.

## Pre-requisitos na maquina do colega

- Windows com WSL funcionando
- Claude Desktop instalado e atualizado
- nome da distribuicao WSL conhecido

Para descobrir o nome da distribuicao WSL, rode no PowerShell:

```powershell
wsl -l -v
```

## Passo a passo de instalacao

1. Entregue ao colega o arquivo `conector-wsl.mcpb`.
2. Peca para ele abrir o Claude Desktop.
3. No Claude Desktop, acesse `Settings > Extensions > Advanced settings > Extension Developer > Install Extension...`
4. Selecione o arquivo `conector-wsl.mcpb`.
5. Preencha os campos pedidos pelo instalador.
6. Conclua a instalacao.
7. Reinicie o Claude Desktop se o app pedir ou se as tools ainda nao aparecerem.

Os colegas nao precisam:

- clonar este repositorio
- rodar `npm install`
- editar arquivo JSON de configuracao
- cadastrar URL de servidor MCP remoto

## Como preencher os campos da instalacao

Use estes valores como referencia:

- `Diretorio inicial`
  Exemplo: `/home/joao`
  Esse e o ponto de partida das acoes do Claude no WSL.

- `Diretorios liberados`
  Exemplo: `/home/joao:/mnt/c/Users/Joao`
  Esses sao os caminhos que o Claude podera usar.

- `Distribuicao WSL`
  Exemplo: `Ubuntu-24.04`
  Esse e o nome exato retornado por `wsl -l -v`.

## Teste rapido depois de instalar

Depois da instalacao, abra uma conversa ou tarefa no Cowork e teste com algo simples, por exemplo:

```text
Use o conector WSL e rode `pwd` no meu ambiente.
```

Se a resposta vier com o caminho do WSL, o conector esta ativo.

## Artefato de instalacao

O arquivo usado para instalar nas maquinas dos colegas e:

```text
conector-wsl.mcpb
```

## Publicacao na organizacao

Esta publicacao organizacional usa o mesmo arquivo `conector-wsl.mcpb` que ja funciona na instalacao individual. Nao e necessario mudar o conector atual nem reconfigurar o que ja esta funcionando no seu Claude.

Importante:

- este projeto deve ser publicado como `Desktop Extension (.mcpb)`
- nao deve ser publicado pelo fluxo de `Plugins ZIP` do marketplace do Cowork

Quem faz essa etapa:

- `Owner` ou `Primary Owner` da organizacao no Claude Desktop

Passo a passo:

1. Abrir o Claude Desktop com uma conta administradora da organizacao.
2. Ir em `Organization settings > Connectors > Desktop`.
3. Se a organizacao usar controle centralizado, ativar a `allowlist` de extensoes.
4. Clicar em `Add custom extension`.
5. Selecionar o arquivo `conector-wsl.mcpb`.
6. Concluir o upload da extensao.
7. Em `Custom team extensions`, abrir o menu `...` da extensao e clicar em `Add to team`.

Resultado esperado:

- a extensao passa a ficar disponivel para o time pela organizacao
- isso nao altera a sua instalacao individual ja existente

Atualizacao futura:

1. Gerar uma nova versao do bundle com `npm run package`.
2. Manter o mesmo identificador do conector.
3. Subir a nova versao no mesmo painel organizacional usando `Upload new version`.

Referencia oficial:

- `Gerenciar plugins do Cowork para sua organizacao` serve para plugins ZIP e sincronizacao GitHub, nao para este projeto.
- para este conector, use o fluxo de `Desktop Extensions` e `allowlist` organizacional no Claude Desktop.

## Como atualizar para uma nova versao

Quando este projeto evoluir, o responsavel pelo repositorio gera um novo bundle e redistribui o arquivo atualizado:

```bash
npm run package
```

Depois disso, os colegas so precisam instalar a versao nova do `.mcpb`.

## Limites conhecidos

- Ele nao cria um TTY interativo real.
- A sessao preserva `cwd` e variaveis exportadas, mas nao preserva bem aliases, funcoes shell e variaveis nao exportadas.
- As operacoes de arquivo trabalham com texto UTF-8.
- O Claude continua limitado aos caminhos liberados na instalacao.
