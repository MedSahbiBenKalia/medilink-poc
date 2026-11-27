# infra/

Tache 1 : bases de donnees, RabbitMQ, Mailpit, docker-compose, plan reseau.
Toutes les valeurs (IP, ports, comptes, noms) viennent de [`../interfaces.md`](../interfaces.md).

## Contenu prevu

```
infra/
  .env.example          # ports et comptes (copier en .env)
  docker-compose.yml    # profils pc2 / pc3 / pc4 / all (plan B)
  postgres/init/        # scripts SQL : schemas + donnees de test
  rabbitmq/             # exchange soins.evenements, file stock.sous-seuil
  README.md
```

## Avancement

- [x] Etape 1 : squelette (ce fichier, `.env.example`)
- [x] Etape 2 : schemas SQL et donnees de test (`postgres/init/01-soins.sql`, `02-pharmacie.sql`, `03-gestion.sql`)
- [ ] Etape 3 : docker-compose, RabbitMQ, Mailpit
- [ ] Etape 4 : verification sur un PC
- [ ] Etape 5 : plan reseau (docs/)
