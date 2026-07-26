# Extension Chromium

## Construire

```bash
npm run extension:build
```

Le résultat chargeable se trouve dans `apps/extension/build`. Ce dossier est
généré et n’est pas versionné.

En développement, `npm run dev` reconstruit automatiquement l’extension. Chrome ne
recharge pas automatiquement un service worker MV3 : utiliser le bouton
**Recharger** dans `chrome://extensions`.

## Permissions

Permissions permanentes :

- `storage` : paramètres, token de pairing et métadonnées bornées ;
- `alarms` : synchronisation périodique ;
- accès hôte limité à `x.com`, `twitter.com` et `www.instagram.com`.

L’accès au serveur SaveMarks est demandé au moment du pairing, uniquement pour
l’origine configurée. L’extension ne demande pas la permission `cookies`.

## Pairing

Le serveur doit connaître l’ID Chrome dans :

```dotenv
SAVEMARKS_ALLOWED_EXTENSION_IDS=<id-extension>
```

Le pairing échange un code court contre un token aléatoire. Le token brut reste
dans `chrome.storage.local`; le serveur ne stocke que son hash. Modifier
`SAVEMARKS_TOKEN_PEPPER` invalide indirectement tous les tokens existants.

## Popup

Le popup affiche :

- état du serveur ;
- état du pairing ;
- éléments en attente et en erreur ;
- dernier sync réussi ;
- état actuel des adapters X et Instagram ;
- bouton de retry manuel.

## Diagnostics

Ils sont désactivés par défaut.

1. Ouvrir **Settings**.
2. Cocher **Enable extraction diagnostics**.
3. Sauvegarder.
4. Ouvrir une page X ou Instagram.
5. Effectuer une seule action ciblée.
6. Revenir dans **Settings** et ouvrir **Diagnostics**.
7. Désactiver les diagnostics dès la capture terminée.

Le panneau permet de filtrer par URL, opération et champ, puis d’exporter un JSON
sanitisé. Ne jamais committer une capture avant :

```bash
npm run fixtures:check
```

et une inspection manuelle. Voir [manual-testing.md](manual-testing.md).

## Réinitialiser l’extension

Pour supprimer localement token, paramètres, diagnostics et queue :

1. ouvrir `chrome://extensions` ;
2. ouvrir les détails de SaveMarks ;
3. utiliser **Effacer les données** si le navigateur le propose, ou retirer puis
   recharger l’extension.

Cette opération ne supprime aucune donnée du serveur PostgreSQL.
