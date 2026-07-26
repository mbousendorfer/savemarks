# SaveMarks

SaveMarks est une bibliothèque locale et auto-hébergée pour les favoris X et les
publications enregistrées sur Instagram.

> **État actuel : fondation + spike d’extraction.** Le serveur local, le pairing,
> la base PostgreSQL, l’extension Chromium, la file hors-ligne et les outils de
> diagnostic sont présents. L’extraction X/Instagram doit encore être validée
> avec une session réelle avant d’implémenter la bibliothèque visuelle complète.

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

Il reste ensuite trois actions manuelles :

1. charger `apps/extension/build` depuis `chrome://extensions` ;
2. copier l’identifiant de l’extension dans `SAVEMARKS_ALLOWED_EXTENSION_IDS`
   dans `.env` ;
3. lancer `npm run dev`, puis ouvrir [http://localhost:3210](http://localhost:3210).

Le guide complet, captures comprises, est dans
[docs/getting-started.md](docs/getting-started.md).

## Commandes utiles

| Commande | Effet |
| --- | --- |
| `npm run setup` | Prépare un environnement local neuf |
| `npm run dev` | Lance le web et reconstruit l’extension à chaque changement |
| `npm run extension:build` | Construit uniquement l’extension |
| `npm run infra:up` | Démarre PostgreSQL |
| `npm run infra:down` | Arrête PostgreSQL sans supprimer les données |
| `npm run db:migrate` | Applique les migrations existantes |
| `npm run check` | Typecheck, lint, tests, scan des fixtures et build |

## Documentation

- [Installation locale et premier lancement](docs/getting-started.md)
- [Installation et utilisation de l’extension](docs/extension.md)
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
