# Développement

## Structure

```text
apps/web                 Next.js, API et écran de pairing
apps/extension           extension Manifest V3
packages/shared          modèles Zod et utilitaires communs
packages/extraction      diagnostics et adapters de sources
packages/database        schéma Drizzle, migrations et stockage média
infrastructure           Docker Compose local et Unraid
data                     PostgreSQL, médias et sauvegardes locales (hors Git)
docs                     documentation opérateur et technique
```

## Environnement

Les commandes racine chargent automatiquement `.env` avec `dotenv-cli`.

Variables principales :

| Variable                          | Description                                   |
| --------------------------------- | --------------------------------------------- |
| `DATABASE_URL`                    | Connexion PostgreSQL utilisée hors Docker     |
| `SAVEMARKS_TOKEN_PEPPER`          | Secret serveur pour hasher codes et tokens    |
| `SAVEMARKS_WEB_USERNAME`          | Identifiant de la web app (production)        |
| `SAVEMARKS_WEB_PASSWORD`          | Mot de passe de la web app (production)       |
| `SAVEMARKS_ALLOWED_EXTENSION_IDS` | IDs Chrome autorisés, séparés par virgules    |
| `SAVEMARKS_DEV_ORIGINS`           | Origines web CORS autorisées en développement |
| `SAVEMARKS_PORT`                  | Port publié par Compose                       |
| `POSTGRES_DATA_PATH`              | Données PostgreSQL sur l’hôte                 |
| `MEDIA_DATA_PATH`                 | Médias téléchargés sur l’hôte                 |
| `BACKUP_DATA_PATH`                | Destination des sauvegardes                   |
| `SAVEMARKS_DATA_PATH`             | Volume `/data` du déploiement Unraid          |

Ne jamais committer `.env`.

## Commandes

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test
npm run fixtures:check
npm run check
```

Construire localement la même image que celle publiée par GitHub :

```bash
docker compose \
  --env-file .env.unraid \
  -f infrastructure/docker-compose.yml \
  -f infrastructure/docker-compose.build.yml \
  build web
```

Base de données :

```bash
npm run infra:up
npm run infra:logs
npm run db:generate
npm run db:migrate
npm run infra:down
```

`npm run db:generate` s’utilise après une modification de
`packages/database/src/schema.ts`. Inspecter le SQL généré avant commit.

## Ajouter une migration

1. Modifier le schéma Drizzle.
2. Lancer `npm run db:generate`.
3. Lire le nouveau fichier dans `packages/database/drizzle`.
4. Lancer `npm run db:migrate`.
5. Exécuter `npm run check`.

## Ajouter une fixture d’extraction

Les fixtures doivent provenir du panneau Diagnostics et ne contenir que le
minimum nécessaire.

```bash
npm run fixtures:check
```

Le scanner cherche cookies, bearer tokens, CSRF, sessions, emails et paramètres
d’URL sensibles. Ce contrôle ne remplace pas l’inspection humaine.

## Contrats de message

Tout message page → content script est validé par Zod. Le bridge MAIN-world doit
rester une interface fixe et minimale. Ne jamais lui ajouter d’exécution de code
arbitraire, de capture de headers ou de requête générique.

## Définition de terminé

Avant de pousser :

```bash
npm run check
git status
```

Le build Next.js peut avoir besoin d’ouvrir un worker local. Dans un environnement
sandboxé, utiliser un terminal standard si Turbopack échoue avec `EPERM`.
