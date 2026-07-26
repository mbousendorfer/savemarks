# Installation locale et premier lancement

Ce guide part d’une machine neuve et mène jusqu’au pairing de l’extension.

## 1. Installer les prérequis

Il faut :

- Node.js 22 ou plus récent ;
- pnpm 11 via Corepack ;
- Docker Desktop, OrbStack ou un moteur Docker compatible Compose v2 ;
- Chrome, Chromium, Brave ou Edge.

Vérification :

```bash
node --version
corepack enable
pnpm --version
docker compose version
```

## 2. Récupérer le projet

```bash
git clone https://github.com/mbousendorfer/savemarks.git
cd savemarks
pnpm install
```

## 3. Préparer l’environnement

```bash
pnpm setup
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
5. Copier l’**ID** affiché sur la carte SaveMarks.

Dans `.env`, compléter :

```dotenv
SAVEMARKS_ALLOWED_EXTENSION_IDS=abcdefghijklmnopabcdefghijklmnop
```

Plusieurs installations peuvent être séparées par des virgules.

## 5. Lancer les applications

```bash
pnpm dev
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

1. Sur `http://localhost:3210`, cliquer **Generate pairing code**.
2. Cliquer sur l’icône SaveMarks dans Chrome, puis **Settings**.
3. Utiliser `http://localhost:3210` comme URL du serveur.
4. Saisir le code de huit caractères.
5. Cliquer **Pair extension**.

Le code expire après cinq minutes et ne fonctionne qu’une fois. Le popup doit
ensuite afficher **Connected** et **online**.

## 7. Ce qui fonctionne à ce stade

- pairing sécurisé extension ↔ serveur ;
- vérification de santé du serveur ;
- queue IndexedDB persistante et retry ;
- diagnostics réseau opt-in sur X et Instagram ;
- export de fixtures sanitisées ;
- ingestion API de favoris déjà normalisés ;
- schéma PostgreSQL et stockage média content-addressed.

L’extraction réelle des favoris n’est pas encore activée : elle nécessite le
protocole de test décrit dans [manual-testing.md](manual-testing.md). C’est
volontaire afin de ne pas inventer d’endpoint privé.

## 8. Arrêter et reprendre

Arrêter le serveur de développement avec `Ctrl+C`.

Arrêter PostgreSQL sans supprimer les données :

```bash
pnpm infra:down
```

Reprendre plus tard :

```bash
pnpm infra:up
pnpm dev
```

Voir [troubleshooting.md](troubleshooting.md) si une étape échoue.
