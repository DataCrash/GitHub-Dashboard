# GitHub Dashboard

Dashboard profissional em HTML/CSS/JS para exibir um overview de conta GitHub e seus principais repositórios.

## Recursos

- Visual moderno com layout responsivo (desktop e mobile)
- Modo Dark/Light com persistência em LocalStorage
- Busca de usuário GitHub
- KPIs principais: repositórios, seguidores, seguindo e stars (top repos)
- Lista de principais repositórios por estrelas
- Lista de atividade recente (updates)
- Distribuição de linguagens (estimada por repositórios públicos)

## Como executar localmente

1. Abra o arquivo `index.html` no navegador.
2. Digite o usuário GitHub e clique em "Carregar".

## Publicação no GitHub Pages

1. Faça push deste projeto para o repositório `GitHub-Dashboard`.
2. Em GitHub > Settings > Pages:
   - Source: Deploy from a branch
   - Branch: `main` / `/ (root)`
3. Aguarde a URL pública ser gerada.

## Observações

- Os dados são carregados pela API pública do GitHub.
- Em caso de limite de requisições da API, aguarde alguns minutos e tente novamente.
