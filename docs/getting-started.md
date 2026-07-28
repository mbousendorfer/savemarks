# Installation locale et premier lancement

Ce guide part d’une machine neuve et mène jusqu’à l’affichage des bookmarks
dans la bibliothèque web.

## 1. Installer les prérequis

Il faut :

- Node.js 22 ou plus récent ;
- npm 10 ou plus récent (fourni avec Node.js) ;
- Docker Desktop, OrbStack ou un moteur Docker compatible Compose v2 ;
- Chrome, Chromium, Brave ou Edge.

Sur macOS, l’installation la plus courte est :

```bash
brew install --cask orbstack
open -a OrbStack
```

Attendre qu’OrbStack soit prêt avant de continuer. Installer uniquement le
paquet Homebrew `docker` ne suffit pas : il fournit le client en ligne de
commande, mais pas le moteur ni Docker Compose.

Vérification :

```bash
node --version
npm --version
docker compose version
docker info
```

## 2. Récupérer le projet

```bash
git clone https://github.com/mbousendorfer/savemarks.git
cd savemarks
npm install
```

## 3. Préparer l’environnement

```bash
npm run setup
```

Cette commande :

1. crée `.env` depuis `.env.example` s’il n’existe pas ;
2. génère un `SAVEMARKS_TOKEN_PEPPER` aléatoire ;
3. démarre PostgreSQL et attend qu’il soit sain ;
4. applique la migration Drizzle ;
5. construit l’extension dans `apps/extension/build`.

Elle ne remplace jamais un `.env` existant.

## 4. Charger l’extension dans Chrome

1. Ouvrir `chrome://extensions`.
2. Activer **Mode développeur**.
3. Cliquer **Charger l’extension non empaquetée**.
4. Choisir le dossier absolu `apps/extension/build`.
5. En développement local, aucune autre configuration n’est nécessaire.

SaveMarks accepte automatiquement une extension Chrome valide lorsque
`SAVEMARKS_ALLOWED_EXTENSION_IDS` est vide et que le serveur tourne en mode
développement. En production, l’ID affiché sur la carte SaveMarks doit
obligatoirement être ajouté à cette variable.

## 5. Lancer les applications

```bash
npm run dev
```

Cette commande garde deux processus actifs :

- l’application Next.js sur `http://localhost:3210` ;
- le build de l’extension en mode surveillance.

Ouvrir :

- application : [http://localhost:3210](http://localhost:3210) ;
- santé API : [http://localhost:3210/api/health](http://localhost:3210/api/health).

Après une modification de l’extension, retourner dans `chrome://extensions` et
cliquer sur l’icône de rechargement de SaveMarks.

## 6. Pairer l’extension

1. Sur `http://localhost:3210`, cliquer **Pair extension**.
2. Cliquer sur l’icône SaveMarks dans Chrome, puis **Settings**.
3. Utiliser `http://localhost:3210` comme URL du serveur.
4. Saisir le code de huit caractères.
5. Cliquer **Pair extension**.

Le code expire après cinq minutes et ne fonctionne qu’une fois. Le popup doit
ensuite afficher **Connected** et **online**.

## 7. Importer et consulter les bookmarks X

1. Ouvrir `https://x.com/i/bookmarks` dans le navigateur où SaveMarks est
   installé.
2. Ouvrir le popup SaveMarks, puis cliquer **Settings**.
3. Dans la section d’import X, lancer l’import historique. L’import est paginé,
   peut être mis en pause et reprend à partir de son dernier curseur.
4. Revenir sur [http://localhost:3210](http://localhost:3210). Les éléments
   importés apparaissent directement dans la bibliothèque.

La barre latérale filtre par source et type de média. La recherche porte sur le
texte, le nom, le compte de l’auteur et les tags. Cliquer sur une carte ouvre sa
fiche, permet d’ajouter ou retirer des tags et donne le lien vers la publication
originale.

Les médias synchronisés sont téléchargés automatiquement sous
`data/media/x/media/pictures` et `data/media/x/media/videos`. En Docker, ces
dossiers se trouvent sous le volume configuré par `MEDIA_DATA_PATH`.

## 8. Ce qui fonctionne à ce stade

- pairing sécurisé extension ↔ serveur ;
- bibliothèque web alimentée par PostgreSQL ;
- recherche, filtres média précis, vues grille/liste et détail d’un bookmark ;
- tags personnalisés éditables et recherchables ;
- archivage local automatique des images et vidéos X ;
- vérification de santé du serveur ;
- queue IndexedDB persistante et retry ;
- diagnostics réseau opt-in sur X et Instagram ;
- export de fixtures sanitisées ;
- ingestion des pages de bookmarks X observées ;
- import historique X paginé, annulable et reprenable depuis Settings ;
- ingestion API de favoris déjà normalisés ;
- importeur Instagram paginé en attente d’une réponse Saved réelle valide ;
- schéma PostgreSQL et stockage média content-addressed.

L’extraction X repose sur une requête observée et validée localement, sans
identifiant GraphQL inventé. L’interface Saved Instagram renvoie actuellement
sa propre erreur sur le compte testé ; voir
[extraction-instagram.md](extraction-instagram.md) pour le statut exact.

## 9. Arrêter et reprendre

Arrêter le serveur de développement avec `Ctrl+C`.

Arrêter PostgreSQL sans supprimer les données :

```bash
npm run infra:down
```

Reprendre plus tard :

```bash
npm run infra:up
npm run dev
```

Voir [troubleshooting.md](troubleshooting.md) si une étape échoue.
