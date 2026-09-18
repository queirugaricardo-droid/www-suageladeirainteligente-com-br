# Aprimorar análise visual e quantidades

## Objetivo
Tornar a identificação dos alimentos mais cuidadosa e deixar estoque, itens detectados e lista de compras mais visuais, com emojis e ajustes rápidos.

## Implementação
- Aumentar o nível de raciocínio da análise para `medium` e orientar a IA a inspecionar porta, prateleiras e gavetas separadamente.
- Exigir contagem exata de itens discretos e incluir um emoji representativo por alimento na resposta da IA.
- Preservar o emoji nos dados do relatório, com uma função local de fallback para itens antigos, manuais ou sem emoji válido.
- Adicionar ao relatório a seção “Alimentos detectados pela IA”, mostrando emoji, nome, quantidade/unidade e controles `−`/`+`.
- Ao ajustar uma quantidade detectada, recalcular imediatamente o comparativo, o medidor, os itens faltantes e a lista de compras, salvando o relatório atualizado.
- Exibir emojis no estoque ideal, no comparativo do relatório, nos itens extras e na lista de compras.
- Atualizar o exemplo prático com emojis para demonstrar o novo visual.

## Validação
- Testar a chamada real de análise da IA e confirmar o novo formato da resposta.
- Conferir no navegador os ajustes `−`/`+`, a atualização do medidor e as listas em telas desktop e móvel.
