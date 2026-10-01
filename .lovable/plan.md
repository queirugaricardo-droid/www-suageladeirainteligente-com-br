# Reforma profissional do fluxo de identificação

## Objetivo
Transformar a foto e identificação em um fluxo confiável de aplicativo: selecionar foto, analisar, revisar cada alimento e só então confirmar os dados que alimentam a geladeira e a lista de compras.

## Implementação
- Reorganizar a navegação e a tela inicial para priorizar “Escanear minha geladeira”, com um resumo rápido de estoque, itens acabando e compras.
- Separar análise e confirmação: a IA retorna uma prévia editável, sem salvar automaticamente.
- Apresentar os detectados em cards agrupados por categoria, com quantidade, unidade, confiança e estados “Alta confiança” ou “Revisar”.
- Permitir confirmar individualmente, editar nome/quantidade/categoria, remover e adicionar manualmente alimentos não encontrados.
- Exibir o resumo “X itens identificados — Y precisam de revisão” e impedir confirmação silenciosa de itens pendentes.
- Ao confirmar, atualizar a comparação e a lista de compras, preservando o estoque e os relatórios já salvos.
- Refinar estados de carregamento, erro, foto vazia e controles para telas pequenas.
- Manter frequência, preços estimados, mercados e compartilhamento por WhatsApp existentes.

## Premissas
- “Minha geladeira” continuará baseada no estoque ideal e no último relatório confirmado, preservando o armazenamento local existente.
- Receitas só aparecerá na navegação se houver uma experiência funcional; não será criada uma tela simulada.

## Validação
- Testar foto, revisão, edição, remoção, adição manual, confirmação e reflexos no estoque/lista.
- Conferir estados vazio/erro e layouts desktop e iPhone.
