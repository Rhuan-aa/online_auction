
ADR-003. Uso de caching versionado para obter o estado dos leilões.
 
## Status
Aceita.
 
# Contexto
Com o Event Sourcing, o estado de um leilão é calculado relendo seus eventos, um custo que cresce com o número de lances e pesa mais nos segundos finais e após reinícios. Isso pode ser resolvido relendo sempre todos os eventos, mantendo um modelo de leitura separado (CQRS) ou guardando o estado calculado como uma cópia derivada (cache), atualizada por tempo de expiração (TTL) ou pela versão do leilão.
 
# Decisão
Adotaremos cache versionado em duas camadas: um checkpoint no PostgreSQL, gravado a cada N eventos, e uma cópia no Redis, atualizada após cada commit. Para obter o estado, o serviço usa a cópia mais recente e busca no Event Store apenas os eventos posteriores à versão dela.

Reler tudo deixaria o sistema lento na disputa final, e o CQRS exigiria um segundo modelo e um banco de leitura sem ganho para a consulta principal, que é o estado de cada leilão. O estado muda a cada lance, mas em um leilão disputado é lido muitas vezes entre um lance e outro. Atualizaremos pela versão, e não por TTL, porque os eventos são imutáveis: uma cópia antiga está incompleta, nunca errada.

O Event Store continua sendo a única fonte da verdade. Se um lance for decidido sobre uma cópia velha, o banco recusa a gravação e o pedido recarrega da fonte, e o encerramento sempre reconstrói o estado a partir dele.

Os comandos sempre completam a cópia com os eventos posteriores. As consultas confiam na cópia do Redis, sem ir ao Event Store, quando ela tem pelo menos a versão mínima pedida (`?versaoMinima=`, opcional); se estiver atrás, completam pela fonte e a corrigem. Cada evento que chega pelo Kafka ao serviço de leitura pede o estado com a versão dele, o que corrige uma cópia que a escrita não conseguiu gravar.
 
# Consequências
Benefícios:
Cada operação lê poucos eventos, e o tempo para obter o estado deixa de crescer com o número de lances. Se o Redis cair, o sistema continua correto, apenas mais lento, e as cópias podem ser apagadas e reconstruídas a partir dos eventos.
 
Trade-offs:
O serviço de escrita fica mais complexo, pois precisa manter as cópias, evitar que vários pedidos reconstruam o mesmo leilão ao mesmo tempo e limitar a memória do Redis. Cada comando ainda consulta o Event Store pelos eventos posteriores: o cache evita reler o histórico, mas não o acesso ao banco. Uma consulta sem versão mínima pode devolver uma cópia atrás da fonte enquanto o evento seguinte não chega ao serviço de leitura (normalmente milissegundos); a cópia só fica atrás por mais tempo se o Redis e o Kafka falharem juntos. O ganho é pequeno em leilões com poucos eventos e aparece em leilões longos, muito lidos ou após reinícios: numa medição com cerca de 100 eventos, a configuração com cache leu cerca de 0,7 evento por lance contra 50 sem cache, mas não foi mais rápida. A lista de leilões abertos é um índice no Redis (ordenado pelo fim), atualizado no mesmo script que grava o estado, e por isso nunca diverge dele; os outros filtros, o histórico de lances e as consultas por licitante são lidos do Event Store, sem banco de leitura separado.
 
# Conformidade
Testes automatizados verificam que o estado obtido pelo cache é igual ao obtido relendo todos os eventos e que o sistema continua funcionando com o Redis desligado. As configurações A (sem cópia), B (só checkpoint) e C (Redis e checkpoint) e as métricas em /actuator/metrics permitem medir o custo de cada camada. O ReconstrutorCache apaga as cópias, refaz a partir dos eventos e compara com o estado anterior.

# Notas
Autor: Mariana. Aprovado por: Christian, Nicolas e Rhuan. Data de aprovação: 12 de novembro de 2026. Atualizada em 14 de novembro de 2026, após a implementação: consultas que confiam na cópia com versão mínima, correção da cópia pelos eventos do Kafka, índice de abertos no Redis e históricos lidos do Event Store. Relacionadas: ADR-002 e ADR-004.
 