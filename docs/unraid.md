# Déploiement sur Unraid

Ce déploiement expose SaveMarks uniquement sur le LAN ou via Tailscale. Aucun
domaine public n’est requis.

## 1. Préparer les répertoires

Exemple conseillé :

```text
/mnt/user/appdata/savemarks/source
/mnt/user/appdata/savemarks/postgres
/mnt/user/appdata/savemarks/media
/mnt/user/appdata/savemarks/backups
```

Cloner le dépôt dans `source` :

```bash
git clone https://github.com/mbousendorfer/savemarks.git \
  /mnt/user/appdata/savemarks/source
cd /mnt/user/appdata/savemarks/source
```

## 2. Configurer les secrets

```bash
cp .env.unraid.example .env.unraid
openssl rand -base64 32
openssl rand -base64 32
```

Utiliser deux valeurs différentes pour `POSTGRES_PASSWORD` et
`SAVEMARKS_TOKEN_PEPPER`.

Compléter aussi :

```dotenv
SAVEMARKS_ALLOWED_EXTENSION_IDS=<id-extension-chrome>
SAVEMARKS_BASE_URL=http://scarif.local:3210
POSTGRES_DATA_PATH=/mnt/user/appdata/savemarks/postgres
MEDIA_DATA_PATH=/mnt/user/appdata/savemarks/media
BACKUP_DATA_PATH=/mnt/user/appdata/savemarks/backups
```

Le fichier `.env.unraid` ne doit jamais être committé.

## 3. Construire et lancer

```bash
docker compose \
  --env-file .env.unraid \
  -f infrastructure/docker-compose.yml \
  up -d --build --wait
```

Le conteneur web applique automatiquement les migrations Drizzle au démarrage,
puis lance Next.js.

Vérifier :

```bash
docker compose \
  --env-file .env.unraid \
  -f infrastructure/docker-compose.yml \
  ps

curl http://scarif.local:3210/api/health
```

## 4. Pairer Chrome

L’extension peut être construite sur une machine de développement avec :

```bash
npm install
npm run extension:build
```

Charger `apps/extension/build` dans Chrome, puis utiliser
`http://scarif.local:3210` ou le hostname Tailscale configuré comme URL serveur.

Si l’ID de l’extension change, mettre à jour
`SAVEMARKS_ALLOWED_EXTENSION_IDS` et recréer le conteneur web :

```bash
docker compose \
  --env-file .env.unraid \
  -f infrastructure/docker-compose.yml \
  up -d --build
```

## Mise à jour

```bash
git pull --ff-only
docker compose \
  --env-file .env.unraid \
  -f infrastructure/docker-compose.yml \
  up -d --build --wait
```

Les migrations sont additives et exécutées avant le nouveau serveur.

## Sauvegardes

Sauvegarder ensemble :

- le dump PostgreSQL ;
- le contenu du dossier média ;
- le fichier `.env.unraid` dans un coffre sécurisé.

Exemple de dump :

```bash
docker compose \
  --env-file .env.unraid \
  -f infrastructure/docker-compose.yml \
  exec -T postgres pg_dump -U savemarks savemarks \
  > /mnt/user/appdata/savemarks/backups/savemarks.sql
```

Ne pas exposer directement le port PostgreSQL sur le LAN.
