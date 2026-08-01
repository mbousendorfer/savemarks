# SaveMarks

SaveMarks est une bibliothèque locale et auto-hébergée pour les favoris X, les
publications enregistrées sur Instagram et les liens à lire plus tard.

> **État actuel : bibliothèque X utilisable.** L’application affiche les
> bookmarks stockés dans PostgreSQL, avec recherche, filtres, vues grille/liste
> et fiche détaillée. Les médias X sont archivés sur disque et les bookmarks
> peuvent être taggés. L’extension Chromium synchronise les nouvelles pages X et
> sait importer l’historique. L’importeur Instagram est implémenté mais attend
> encore une réponse Saved valide de la session réelle pour sa validation finale.

## Démarrage rapide

Prérequis : Node.js 22+ (npm est inclus), Docker et Chrome/Chromium.

```bash
git clone https://github.com/mbousendorfer/savemarks.git
cd savemarks
npm install
npm run setup
```

`npm run setup` crée un `.env` local sécurisé, démarre PostgreSQL, applique les
migrations et construit l’extension.

Il reste ensuite deux actions manuelles :

1. charger `apps/extension/build` depuis `chrome://extensions` ;
2. lancer `npm run dev`, puis ouvrir [http://localhost:3210](http://localhost:3210).

La page d’accueil est la bibliothèque : les bookmarks apparaissent dès qu’ils
ont été synchronisés par l’extension.

La section **Read later** permet aussi d’ajouter directement une URL ou
d’importer jusqu’à 25 000 liens depuis un CSV ou un fichier texte. Voir le
[guide Read later](docs/read-later.md).

Les médias et les données PostgreSQL locales sont conservés dans le dossier
visible `data/` à la racine du projet. Ce dossier est exclu de Git.

Le guide complet, captures comprises, est dans
[docs/getting-started.md](docs/getting-started.md).

## Déploiement Docker / Unraid

Chaque push sur `main` génère automatiquement une image Docker `linux/amd64`
sur GitHub Container Registry :

```text
ghcr.io/mbousendorfer/savemarks:latest
```

Le Compose fourni utilise cette image, PostgreSQL et un dossier hôte `/data`
contenant tous les médias et exports. Le serveur Unraid n’a donc besoin ni du
code source ni de Node.js. Voir le
[guide Unraid pas à pas](docs/unraid.md).

En production, la bibliothèque et ses médias locaux sont protégés par un nom
d’utilisateur et un mot de passe configurés dans `.env`. L’extension conserve
une authentification séparée par jeton révocable.

## Commandes utiles

| Commande                  | Effet                                                       |
| ------------------------- | ----------------------------------------------------------- |
| `npm run setup`           | Prépare un environnement local neuf                         |
| `npm run dev`             | Lance le web et reconstruit l’extension à chaque changement |
| `npm run extension:build` | Construit uniquement l’extension                            |
| `npm run infra:up`        | Démarre PostgreSQL                                          |
| `npm run infra:down`      | Arrête PostgreSQL sans supprimer les données                |
| `npm run db:migrate`      | Applique les migrations existantes                          |
| `npm run check`           | Typecheck, lint, tests, scan des fixtures et build          |

## Documentation

- [Installation locale et premier lancement](docs/getting-started.md)
- [Installation et utilisation de l’extension](docs/extension.md)
- [Read later et import CSV](docs/read-later.md)
- [Développement et commandes](docs/development.md)
- [Déploiement sur Unraid](docs/unraid.md)
- [Dépannage](docs/troubleshooting.md)
- [Tests manuels d’extraction](docs/manual-testing.md)
- [Architecture](docs/architecture.md)
- [Sécurité](docs/security.md)
- [État du spike X](docs/extraction-x.md)
- [État du spike Instagram](docs/extraction-instagram.md)

## Confidentialité

SaveMarks ne transmet jamais les cookies X ou Instagram au serveur. Aucun
endpoint privé, identifiant GraphQL ou format de réponse non vérifié n’est
codé en dur. Les diagnostics sont désactivés par défaut et leurs exports doivent
passer `npm run fixtures:check` avant tout commit.
