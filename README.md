# SERVA Futsal

Painel da temporada do SERVA Futsal e área de lançamento dos jogos.

- **Site:** https://caiomancuso.github.io/ServaFutsal/
- **Admin:** https://caiomancuso.github.io/ServaFutsal/admin.html

Site estático (GitHub Pages) com banco de dados no Supabase (projeto `serva-futsal`, região São Paulo).

## Páginas

| Página | Para quem | O que tem |
|---|---|---|
| `index.html` | Time (público, só leitura) | **Resumo:** último jogo, consolidado por quadro e artilharia. **Elenco:** atletas atuais e quem saiu do elenco. **Jogos:** todos os jogos da temporada. |
| `admin.html` | Administrador (login) | **Lançar jogo:** placar por quadro, presença, gols, apito e horário. **Jogos:** editar/excluir e ver pendências. **Atletas:** incluir, marcar saída, excluir. **Ocorrências** e **Mensalidades**. |

No formulário de jogo, os campos de gols, apito e horário aparecem quando o atleta é marcado como **Presente**. O sistema avisa se a soma dos gols dos atletas não bate com o placar.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html`, `app.js` | Painel público |
| `admin.html`, `admin.js` | Área administrativa |
| `common.js` | Funções compartilhadas |
| `config.js` | URL e chave pública do Supabase (pode ser pública: a escrita é protegida por login e regras no banco) |
| `style.css` | Identidade visual (cores da Hungria, fontes Barlow / Barlow Condensed) |
| `logo.png`, `favicon.png` | Escudo do SERVA |
| `vendor/supabase.js` | Biblioteca do Supabase (versão fixa, sem depender de CDN) |
| `.github/workflows/publicar.yml` | Extrai automaticamente qualquer `.zip` enviado para a raiz e publica |
| `.github/workflows/keepalive.yml` | Consulta o banco às segundas e quintas para o Supabase gratuito não pausar |

## Como atualizar o site

- **Por zip:** *Add file → Upload files*, envie o `.zip` do site e faça o commit. A automação extrai, apaga o zip e publica em 1–2 minutos (qualquer nome de zip funciona; a pasta `.github` do zip é ignorada).
- **Arquivo a arquivo:** edite direto no GitHub e faça o commit.
- O navegador pode mostrar a versão anterior por até 10 minutos. **Ctrl+F5** força a atualização.

## Banco de dados

Tabelas: `atletas`, `partidas`, `quadros` (placar de cada quadro), `participacao` (presença, horário, aviso de ausência, apito), `gols`, `ocorrencias`, `mensalidades`, `regras_pontos` (pontuação configurável).

Views: `v_atletas_stats` (estatísticas por atleta), `v_pontuacao` (pontuação), `v_pendencias` (placar que não bate com os gols, gol sem presença).

**Acesso:** leitura pública; gravação só para e-mails cadastrados na tabela `admins`.

## Cuidados

- **Automação agendada:** o GitHub desativa automações agendadas de repositórios públicos após 60 dias sem commits. Se isso acontecer, reative o "Manter banco ativo" em *Actions*, senão o Supabase volta a pausar.
- **Novo administrador:** inserir o e-mail na tabela `admins` no Supabase.

## Padrão de código

Elementos criados com `createElement` (sem `onclick` em strings de HTML). Rodar `node --check` nos arquivos `.js` antes de publicar.
