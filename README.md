# WSL Workspace Connector

Este e o README principal do projeto. Ele explica o que e o conector, o que ele faz e como ele funciona.

O `WSL Workspace Connector` e um conector MCP local para Claude Desktop/Cowork que permite ao Claude trabalhar no seu WSL de forma controlada.

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

## O que ele entrega na pratica

Na pratica, este conector entrega ao Claude um ponto unico de acesso ao ambiente WSL para trabalho assistido.

Isso permite, por exemplo:

- inspecionar estrutura de projetos no WSL
- ler e escrever arquivos de texto nas pastas liberadas
- executar comandos tecnicos no terminal
- manter continuidade de sessao de trabalho
- operar com limite claro de acesso por diretorio

## Limites conhecidos

- Ele nao cria um TTY interativo real.
- A sessao preserva `cwd` e variaveis exportadas, mas nao preserva bem aliases, funcoes shell e variaveis nao exportadas.
- As operacoes de arquivo trabalham com texto UTF-8.
- O Claude continua limitado aos caminhos liberados na instalacao.

## Documentacao operacional

Toda a parte operacional fica separada do README principal:

- instalacao para colegas
- uso do script `instalar-mcp-manual.ps1`
- validacao no Claude/Cowork
- publicacao na organizacao

Essa documentacao esta em `entrega-colegas/README.md`.
