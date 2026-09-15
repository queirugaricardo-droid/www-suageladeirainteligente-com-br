# Geladeira Inteligente

App em português para comparar o conteúdo real da geladeira com o estoque ideal do usuário.

## Telas (página única, com abas)

**1. Estoque ideal**
- Lista de alimentos cadastrados: nome, quantidade ideal, unidade (un, kg, L, pacote) e categoria (Hortifrúti, Laticínios, Carnes, Bebidas, Condimentos, Congelados, Outros).
- Adicionar, editar e remover itens.
- Alguns itens de exemplo já cadastrados na primeira visita, para o app não abrir vazio.

**2. Analisar geladeira**
- Botão para tirar foto (câmera do celular) ou carregar uma imagem.
- Pré-visualização da foto e botão "Analisar geladeira".
- Durante a análise: indicador de carregamento com mensagem clara.
- A IA identifica os alimentos visíveis e estima a quantidade de cada um.

**3. Relatório + lista de compras**
- Resumo: quantos itens estão OK, em quantidade baixa e em falta.
- Tabela comparativa: item, quantidade ideal, quantidade detectada, situação (OK / Baixo / Faltando).
- Itens detectados que não estão no estoque ideal aparecem numa seção "Também vi na sua geladeira", com opção de adicionar ao estoque ideal com um toque.
- Lista de compras gerada automaticamente, agrupada por categoria, com caixas de seleção para marcar o que já foi comprado e botão para copiar a lista.

## Detalhes técnicos

- Estoque ideal e último relatório salvos no navegador (localStorage), sem necessidade de login. Se depois o usuário quiser acesso de vários aparelhos, migramos para o Lovable Cloud.
- Análise de imagem via server function do TanStack Start chamando o Lovable AI Gateway com entrada multimodal (imagem em base64) e saída estruturada: lista de `{ nome, quantidade, unidade, confiança }`. A chave de API fica só no servidor.
- Comparação ideal x detectado feita no app (normalização de nomes e correspondência aproximada), não pela IA, para o resultado ser consistente.
- Erros do serviço de IA (créditos, limite, foto ilegível) mostrados como mensagem clara na tela, preservando a foto enviada.
- Visual: tema claro com verde-menta/gelo, tipografia arredondada, cards com cantos suaves — nada de gradiente roxo genérico.
- Título e descrição próprios da página para compartilhamento e busca.

## Novidades pedidas

**4. Medidor de abastecimento**
- Anel/gauge grande no topo do relatório com a porcentagem da geladeira abastecida, calculada como soma das quantidades detectadas dividida pela soma das quantidades ideais (cada item limitado a 100%).
- Cores por faixa: vermelho abaixo de 40%, âmbar até 75%, verde acima disso, com animação suave ao carregar.
- Barras individuais por item no comparativo, mostrando quanto falta de cada um.

**5. Preços perto de você**
- Botão "Usar minha localização" pede permissão ao navegador; se o usuário recusar, ele pode digitar a cidade ou o CEP.
- Mostra mercados próximos (nome, endereço, distância, avaliação) usando o conector do Google Maps, que precisa ser conectado uma vez — vou abrir o cartão de conexão no momento certo.
- Para cada item faltante, uma estimativa de preço em reais pela IA, considerando a região detectada, marcada claramente como estimativa.
- Total estimado da lista de compras, atualizado conforme o usuário marca ou desmarca itens; opção de comparar o total entre os mercados próximos listados.
- Sem localização disponível, a lista continua funcionando com preços médios nacionais.
