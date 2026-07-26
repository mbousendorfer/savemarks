# Dépannage

## `unknown flag: --env-file` ou `docker compose` est inconnu

Le paquet Homebrew `docker` seul installe uniquement le client. SaveMarks a
besoin du moteur Docker et de Compose.

Sur macOS :

```bash
brew install --cask orbstack
open -a OrbStack
```

Attendre qu’OrbStack soit prêt, puis :

```bash
npm run setup
```

## `npm run setup` dit que le moteur Docker est indisponible

Vérifier que Docker Desktop, OrbStack ou le daemon Docker est démarré :

```bash
docker info
docker compose version
```

Si `docker compose version` fonctionne mais pas `docker info`, ouvrir OrbStack
ou Docker Desktop et attendre le démarrage du moteur. Puis relancer
`npm run setup`.

## Le port 5432 est déjà utilisé

Un PostgreSQL local occupe probablement le port :

```bash
docker compose --env-file .env \
  -f infrastructure/docker-compose.dev.yml ps
```

Arrêter l’autre service ou modifier à la fois le port publié dans
`docker-compose.dev.yml` et `DATABASE_URL`.

## Le port 3210 est déjà utilisé

Modifier le script de développement ou arrêter le processus concerné. La
configuration actuelle de Next.js écoute explicitement sur 3210.

## L’application affiche une erreur de base de données

```bash
npm run infra:up
npm run db:migrate
```

Puis vérifier `DATABASE_URL` dans `.env`.

## Le pairing répond « Origin not allowed »

1. Copier l’ID exact depuis `chrome://extensions`.
2. Le placer dans `SAVEMARKS_ALLOWED_EXTENSION_IDS` dans `.env`.
3. Redémarrer `npm run dev`.
4. Générer un nouveau code de pairing.

Ne pas ajouter le préfixe `chrome-extension://` dans `.env` : SaveMarks le fait
lui-même.

## Le code de pairing est invalide

Il expire après cinq minutes et ne s’utilise qu’une fois. Générer un nouveau code
depuis l’application web.

## Le popup affiche « offline »

- ouvrir directement `/api/health` dans Chrome ;
- vérifier l’URL configurée dans Settings ;
- confirmer que Chrome a accordé l’accès à cette origine ;
- sur Unraid, vérifier DNS/mDNS pour `scarif.local` ou utiliser le hostname
  Tailscale.

## L’extension ne reflète pas une modification

`npm run dev` reconstruit les fichiers mais Chrome ne recharge pas le service worker
MV3. Dans `chrome://extensions`, cliquer **Recharger** sur SaveMarks puis
rafraîchir l’onglet X ou Instagram.

## Aucun événement n’apparaît dans Diagnostics

- activer explicitement les diagnostics dans Settings ;
- recharger l’onglet source après activation ;
- effectuer une action sur X ou Instagram ;
- cliquer Refresh dans le panneau ;
- vérifier que la réponse observée est JSON et contient un signal pertinent
  (bookmark, saved, cursor ou pagination).

Le bridge ignore volontairement les autres domaines et les réponses non
pertinentes.

## Turbopack échoue avec `binding to a port` ou `EPERM`

Le worker de build est bloqué par un sandbox. Lancer `npm run build` depuis un
terminal normal hors sandbox.

## Réinitialiser seulement la base locale

Attention : cette opération supprime les données de développement PostgreSQL.
Arrêter Compose, déplacer manuellement le dossier configuré par
`POSTGRES_DATA_PATH`, puis relancer `npm run setup`. Ne jamais supprimer un chemin
non vérifié ou un volume Unraid de production.
