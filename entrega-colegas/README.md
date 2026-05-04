# Instalacao

Dois comandos. Tem que ter o projeto clonado dentro do WSL.

## 1. No WSL (na pasta do projeto)

```bash
bash entrega-colegas/setup-wsl.sh
```

Instala Node 20 se faltar e roda `npm install`. Funciona em Ubuntu, Debian, Fedora, Alpine, Arch, openSUSE.

## 2. No Windows (PowerShell, na pasta `entrega-colegas`)

```powershell
.\instalar-mcp-manual.ps1 -DistroName 'Ubuntu' -LinuxProjectPath '/home/SEU_USUARIO/conector-wsl'
```

Troque `Ubuntu` (ver com `wsl -l -v`) e o caminho do projeto.

Reinicie o Claude Desktop.

## Testar

No Claude:

```
Use o conector WSL e rode `node -v`.
```
