# SERVA Futsal

Painel público da temporada + área de lançamento. Site estático (GitHub Pages) com banco no Supabase (projeto `serva-futsal`).

- `index.html` — painel público: resumo, ranking, elenco, jogos.
- `admin.html` — login e lançamentos: jogo, atletas, ocorrências, mensalidades.
- `config.js` — URL e chave pública do Supabase (pode ficar pública; a escrita é protegida por login + RLS).
- `.github/workflows/keepalive.yml` — consulta o banco 2x por semana para o projeto gratuito não pausar.

## Publicar

1. Crie um repositório no GitHub (ex.: `serva`) e envie todos estes arquivos para a raiz, incluindo a pasta `.github`.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
3. No Supabase (projeto serva-futsal) → Authentication → URL Configuration: defina **Site URL** como o endereço do Pages (ex.: `https://caiomancuso.github.io/serva/admin.html`).
4. Abra `admin.html`, clique em **Primeiro acesso** com o e-mail autorizado, confirme pelo link do e-mail e entre.
5. Depois de criar sua conta: Authentication → Sign In / Providers → desative **Allow new users to sign up**.

## Modelo de dados

`atletas`, `partidas`, `quadros` (placar por quadro), `participacao` (presença, horário, aviso, apito), `gols`, `ocorrencias`, `mensalidades`, `regras_pontos` (pontos configuráveis). Views: `v_atletas_stats`, `v_pontuacao`, `v_pendencias`.

Para autorizar outro administrador: inserir o e-mail na tabela `admins`.

Padrão de código: sem handlers inline em strings; elementos via `createElement`; rodar `node --check` antes de publicar.
