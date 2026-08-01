# Déploiement sur Unraid

SaveMarks est publié automatiquement sous forme d’image Docker sur GitHub
Container Registry :

```text
ghcr.io/mbousendorfer/savemarks:latest
```

L’image supporte `linux/amd64` et `linux/arm64`. Il n’est pas nécessaire de
cloner le dépôt ni d’installer Node.js sur le serveur Unraid.

## Ce qui est stocké sur l’hôte

Deux chemins Unraid persistent toutes les données :

```text
/mnt/user/appdata/savemarks/postgres  base PostgreSQL
/mnt/user/appdata/savemarks/data      médias et sauvegardes exportables
```

Le second chemin est monté dans le conteneur sous `/data`. Après
synchronisation, les médias sont directement accessibles sur Unraid :

```text
/mnt/user/appdata/savemarks/data/media/x/media/pictures
/mnt/user/appdata/savemarks/data/media/x/media/videos
/mnt/user/appdata/savemarks/data/media/instagram/media/pictures
/mnt/user/appdata/savemarks/data/media/instagram/media/videos
/mnt/user/appdata/savemarks/data/backups
```

PostgreSQL reste dans un dossier séparé : ses fichiers internes ne doivent pas
être modifiés manuellement.

## 1. Récupérer les deux fichiers de configuration

Dans le gestionnaire Compose d’Unraid, créer une stack `savemarks`, puis y
copier :

- `infrastructure/docker-compose.yml` en tant que fichier Compose ;
- `.env.unraid.example` en tant que `.env`.

Les mêmes commandes peuvent être lancées depuis un terminal, dans un dossier
contenant ces deux fichiers :

```bash
cp .env.unraid.example .env
```

Le dépôt n’est utile que pour récupérer ces fichiers. L’application elle-même
vient de l’image `ghcr.io`.

## 2. Configurer les secrets

Générer trois valeurs différentes :

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

Dans `.env`, remplacer au minimum :

```dotenv
POSTGRES_PASSWORD=<première-valeur>
SAVEMARKS_TOKEN_PEPPER=<seconde-valeur>
SAVEMARKS_WEB_USERNAME=savemarks
SAVEMARKS_WEB_PASSWORD=<troisième-valeur>
SAVEMARKS_ALLOWED_EXTENSION_IDS=<id-extension-chrome>
POSTGRES_DATA_PATH=/mnt/user/appdata/savemarks/postgres
SAVEMARKS_DATA_PATH=/mnt/user/appdata/savemarks/data
PUID=99
PGID=100
```

`99:100` correspond à l’utilisateur `nobody:users` habituel sur Unraid. Il est
possible de choisir un autre UID/GID si les partages utilisent d’autres
permissions. Le fichier `.env` contient des secrets et ne doit pas être
committé.

À l’ouverture de la web app, le navigateur demandera ce nom d’utilisateur et
ce mot de passe. Cette protection couvre également les médias locaux. Sur un
LAN qui n’est pas entièrement de confiance ou pour un accès distant, publier
SaveMarks derrière HTTPS (par exemple avec Tailscale Serve) afin de chiffrer les
identifiants pendant le transport.

## 3. Donner accès à l’image

L’image est téléchargeable sans authentification si le package GitHub
`savemarks` est public.

S’il est privé, connecter une fois Unraid à GHCR avec un Personal Access Token
GitHub classique possédant uniquement `read:packages` :

```bash
echo '<token-github>' | docker login ghcr.io \
  --username mbousendorfer \
  --password-stdin
```

Le token est alors conservé par Docker sur le serveur. Il ne doit pas être
ajouté au fichier Compose ou à `.env`.

## 4. Lancer SaveMarks

Depuis le dossier de la stack :

```bash
docker compose --env-file .env -f docker-compose.yml pull
docker compose --env-file .env -f docker-compose.yml up -d --wait
```

Le conteneur attend PostgreSQL, applique automatiquement les migrations, puis
lance l’application sur :

```text
http://scarif.local:3210
```

Vérifier l’état :

```bash
docker compose --env-file .env -f docker-compose.yml ps
curl http://scarif.local:3210/api/health
```

Le port PostgreSQL n’est pas publié sur le LAN.

## 5. Rendre SaveMarks accessible hors du réseau local

### Option recommandée : Tailscale Serve

Cette option garde SaveMarks privé : seuls les appareils connectés à votre
tailnet peuvent l’atteindre. Elle fournit aussi automatiquement une URL HTTPS,
sans ouvrir le port 3210 sur le routeur.

Après avoir installé et connecté Tailscale sur Unraid, lancer sur le NAS :

```bash
tailscale serve --bg 3210
tailscale serve status
```

La commande affiche une URL semblable à :

```text
https://scarif.<nom-du-tailnet>.ts.net
```

Installer également Tailscale sur l’ordinateur qui utilise Chrome. Vérifier que
cette URL ouvre la web app, puis l’utiliser telle quelle dans les paramètres de
l’extension. Le client Tailscale doit être connecté lors des synchronisations
effectuées hors du domicile.

### Alternative : domaine public avec reverse proxy

Un domaine public peut aussi pointer vers un reverse proxy HTTPS (Caddy, Nginx
Proxy Manager ou équivalent), qui transfère les requêtes vers
`http://127.0.0.1:3210`. Dans ce cas :

- utiliser un certificat TLS publiquement valide ;
- ne pas publier directement le port 3210 sur Internet ;
- conserver l’authentification web SaveMarks ;
- laisser `/api/pairing/exchange` atteindre SaveMarks sans une seconde page de
  connexion ajoutée par le proxy : cet endpoint est déjà protégé par le code de
  pairing à usage unique, la liste d’IDs d’extension et la limitation de débit ;
- utiliser uniquement l’origine dans l’extension, par exemple
  `https://savemarks.example.com`, sans chemin final.

L’extension refuse volontairement une URL distante en HTTP. Une connexion HTTP
reste possible pour `localhost`, les adresses privées et les noms `.local` sur
le LAN.

## 6. Pairer l’extension Chrome

L’extension est toujours construite sur la machine de développement :

```bash
npm install
npm run extension:build
```

Charger `apps/extension/build` depuis `chrome://extensions`, puis définir l’URL
du serveur : `http://scarif.local:3210` sur le LAN, ou l’URL HTTPS configurée à
l’étape précédente pour un accès distant.

Si l’ID de l’extension change, mettre à jour
`SAVEMARKS_ALLOWED_EXTENSION_IDS` dans `.env`, puis recréer uniquement le
conteneur web :

```bash
docker compose --env-file .env -f docker-compose.yml up -d --force-recreate web
```

## Mettre à jour

Avec le tag `latest`, une mise à jour ne demande aucun `git pull` :

```bash
docker compose --env-file .env -f docker-compose.yml pull
docker compose --env-file .env -f docker-compose.yml up -d --wait
```

Pour figer une version, remplacer `latest` dans `SAVEMARKS_IMAGE` par un tag
publié, par exemple `v1.0.0`.

## Sauvegarder

Créer d’abord un dump cohérent de PostgreSQL :

```bash
docker compose --env-file .env -f docker-compose.yml \
  exec -T postgres pg_dump -U savemarks savemarks \
  > /mnt/user/appdata/savemarks/data/backups/savemarks.sql
```

Sauvegarder ensuite ensemble :

- `/mnt/user/appdata/savemarks/data` ;
- le dump PostgreSQL qui vient d’être créé ;
- le fichier `.env` dans un coffre sécurisé.

Les fichiers bruts de `/mnt/user/appdata/savemarks/postgres` peuvent compléter
une sauvegarde arrêtée, mais le dump SQL est la méthode de restauration
portable recommandée.
